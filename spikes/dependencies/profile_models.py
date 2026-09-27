from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Final

WHISPER_REPOSITORY: Final = "Systran/faster-whisper-small"


def resident_mib() -> float:
    for line in Path("/proc/self/status").read_text(encoding="utf-8").splitlines():
        if line.startswith("VmRSS:"):
            return round(int(line.split()[1]) / 1_024, 2)
    raise RuntimeError("Linux /proc did not expose VmRSS")


def directory_bytes(path: Path) -> int:
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def profile_onnx(model_path: Path) -> dict[str, object]:
    baseline = resident_mib()
    started_at = time.perf_counter()
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    return {
        "coldLoadMs": round((time.perf_counter() - started_at) * 1_000),
        "inputs": [item.name for item in session.get_inputs()],
        "modelBytes": model_path.stat().st_size,
        "residentDeltaMiB": round(resident_mib() - baseline, 2),
        "residentMiB": resident_mib(),
    }


def profile_whisper(model_path: Path) -> dict[str, object]:
    baseline = resident_mib()
    started_at = time.perf_counter()
    from faster_whisper import WhisperModel

    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
    return {
        "coldLoadMs": round((time.perf_counter() - started_at) * 1_000),
        "device": model.model.device,
        "modelBytes": directory_bytes(model_path),
        "residentDeltaMiB": round(resident_mib() - baseline, 2),
        "residentMiB": resident_mib(),
    }


def run_child(kind: str, model_path: Path) -> dict[str, object]:
    result = subprocess.run(
        [sys.executable, __file__, "--child", kind, "--model", str(model_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Profile Svara's local model baseline")
    parser.add_argument("--child", choices=("onnx", "whisper"))
    parser.add_argument("--model", type=Path)
    parser.add_argument("--kokoro-model", type=Path)
    parser.add_argument("--whisper-cache", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.child:
        if args.model is None:
            raise ValueError("--model is required in child mode")
        profile = (
            profile_onnx(args.model)
            if args.child == "onnx"
            else profile_whisper(args.model)
        )
        print(json.dumps(profile))
        return

    if args.kokoro_model is None or args.whisper_cache is None:
        raise ValueError("--kokoro-model and --whisper-cache are required")

    from huggingface_hub import snapshot_download

    whisper_path = Path(
        snapshot_download(
            WHISPER_REPOSITORY,
            local_dir=args.whisper_cache,
        )
    )
    print(
        json.dumps(
            {
                "kokoro": run_child("onnx", args.kokoro_model),
                "whisperSmallInt8": run_child("whisper", whisper_path),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
