"""Read-only Linux process-tree measurement for an owned Electron spike, not acceptance."""

import argparse
import json
import math
import os
import statistics
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Process:
    pid: int
    parent: int
    started: int
    ticks: int
    rss: int

    @property
    def identity(self) -> tuple[int, int]:
        return self.pid, self.started


def parse_stat(value: str, page_size: int) -> Process:
    """comm may contain spaces/parentheses; field 3 begins after its final ')'."""
    prefix, fields = value.rsplit(")", 1)
    pid = int(prefix.split(" ", 1)[0])
    parts = fields.split()
    return Process(
        pid,
        int(parts[1]),
        int(parts[19]),
        int(parts[11]) + int(parts[12]),
        max(0, int(parts[21])) * page_size,
    )


def descendants(
    processes: dict[int, Process], root: int
) -> dict[tuple[int, int], Process]:
    selected = {root}
    while True:
        expanded = selected | {
            p.pid for p in processes.values() if p.parent in selected
        }
        if expanded == selected:
            return {p.identity: p for p in processes.values() if p.pid in selected}
        selected = expanded


def snapshot(root: int) -> dict[tuple[int, int], Process]:
    processes = {}
    page_size = os.sysconf("SC_PAGE_SIZE")
    for directory in Path("/proc").iterdir():
        if not directory.name.isdigit():
            continue
        try:
            process = parse_stat((directory / "stat").read_text(), page_size)
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
        processes[process.pid] = process
    return descendants(processes, root)


def cpu_delta(
    previous: dict[tuple[int, int], Process], current: dict[tuple[int, int], Process]
) -> int:
    # New process identities contribute lifetime ticks; PID reuse never subtracts old ticks.
    return sum(
        max(0, p.ticks - previous[key].ticks) if key in previous else p.ticks
        for key, p in current.items()
    )


def validate_root(root: int) -> tuple[int, int]:
    directory = Path("/proc") / str(root)
    identity = parse_stat(
        (directory / "stat").read_text(), os.sysconf("SC_PAGE_SIZE")
    ).identity
    command = (
        os.fsdecode((directory / "cmdline").read_bytes()).replace("\0", " ").strip()
    )
    repo = Path(__file__).resolve().parents[2]
    expected = repo / "apps/desktop/electron/main.cjs"
    executable = (directory / "exe").resolve()
    if (
        directory.stat().st_uid != os.getuid()
        or "--type=" in command
        or executable.name != "electron"
        or not executable.is_relative_to(repo / "node_modules")
    ):
        raise ValueError("Root must be this user's main Electron spike process")
    # Electron rewrites process.title into one flattened argv string, including spaces in paths.
    if not command.endswith(" " + str(expected)):
        raise ValueError(
            "Root must run this repository's apps/desktop/electron/main.cjs"
        )
    return identity


def measure(root: int, duration: float, interval: float) -> dict[str, object]:
    root_identity = validate_root(root)
    previous = snapshot(root)
    if root_identity not in previous:
        raise RuntimeError("Owned root exited or PID was reused before measurement")
    ticks_per_second = os.sysconf("SC_CLK_TCK")
    started = last = time.monotonic()
    total_ticks = 0
    departed = 0
    samples = []
    while time.monotonic() - started < duration:
        time.sleep(min(interval, max(0, duration - (time.monotonic() - started))))
        current = snapshot(root)
        now = time.monotonic()
        if root_identity not in current:
            raise RuntimeError(
                "Owned root exited or PID was reused; measurement aborted"
            )
        delta = cpu_delta(previous, current)
        total_ticks += delta
        departed += len(previous.keys() - current.keys())
        samples.append(
            {
                "elapsedSeconds": now - started,
                "cpuPercentOneCore": delta / ticks_per_second / (now - last) * 100,
                "rssMiB": sum(p.rss for p in current.values()) / 1024**2,
                "processes": len(current),
            }
        )
        previous, last = current, now
    elapsed = last - started
    return {
        "durationSeconds": elapsed,
        "intervalSeconds": interval,
        "cpuPercentOneCore": total_ticks / ticks_per_second / elapsed * 100,
        "rssMedianMiB": statistics.median(float(s["rssMiB"]) for s in samples),
        "rssPeakMiB": max(float(s["rssMiB"]) for s in samples),
        "departedProcesses": departed,
        "samples": samples,
        "scope": "Electron main and live descendants; excludes preview, core and compositor",
        "limitations": "RSS includes shared pages; sampled exits can undercount CPU; no product acceptance",
    }


def bounded_seconds(value: str) -> float:
    result = float(value)
    if not math.isfinite(result) or not 0.1 <= result <= 3600:
        raise argparse.ArgumentTypeError(
            "Seconds must be finite and between 0.1 and 3600"
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--duration", type=bounded_seconds, default=300.0)
    parser.add_argument("--interval", type=bounded_seconds, default=5.0)
    args = parser.parse_args()
    if args.pid <= 0:
        parser.error("PID must be positive")
    print(json.dumps(measure(args.pid, args.duration, args.interval), indent=2))


if __name__ == "__main__":
    main()
