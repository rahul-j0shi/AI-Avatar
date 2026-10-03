import argparse
import os

import pytest
import resource_probe
from resource_probe import (
    Process,
    bounded_seconds,
    cpu_delta,
    descendants,
    parse_stat,
    validate_root,
)


def test_stat_handles_nested_parentheses_and_does_not_include_child_ticks() -> None:
    fields = ["S"] + ["0"] * 21
    fields[1], fields[11], fields[12], fields[13] = "5", "100", "30", "9999"
    fields[19], fields[21] = "456", "10"
    result = parse_stat("42 (worker (test)) " + " ".join(fields), 4096)
    assert result == Process(42, 5, 456, 130, 40960)


def test_descendants_include_all_generations_but_not_unrelated_apps() -> None:
    processes = {
        p.pid: p
        for p in [
            Process(1, 0, 1, 0, 0),
            Process(2, 1, 2, 10, 5),
            Process(3, 2, 3, 20, 6),
            Process(4, 1, 4, 100, 7),
        ]
    }
    assert {p.pid for p in descendants(processes, 2).values()} == {2, 3}


def test_delta_uses_identity_not_pid_and_never_double_counts_waited_children() -> None:
    old = [Process(2, 1, 2, 100, 1), Process(3, 2, 3, 1000, 1)]
    new = [Process(2, 1, 2, 120, 1), Process(3, 2, 99, 10, 1), Process(4, 2, 4, 5, 1)]
    assert cpu_delta({p.identity: p for p in old}, {p.identity: p for p in new}) == 35
    assert cpu_delta({p.identity: p for p in new}, {}) == 0


@pytest.mark.parametrize("value", ["nan", "inf", "-1", "0", "3601"])
def test_duration_rejects_unbounded_input(value: str) -> None:
    with pytest.raises(argparse.ArgumentTypeError):
        bounded_seconds(value)


def test_sampler_rejects_non_spike_root() -> None:
    with pytest.raises(ValueError, match="Root must"):
        validate_root(os.getpid())


def test_measurement_is_percent_of_one_core_and_records_process_departure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = [0.0]
    states = iter(
        [
            {
                (2, 2): Process(2, 1, 2, 100, 1024**2),
                (3, 3): Process(3, 2, 3, 20, 1024**2),
            },
            {(2, 2): Process(2, 1, 2, 200, 2 * 1024**2)},
        ]
    )
    monkeypatch.setattr(resource_probe, "validate_root", lambda _root: (2, 2))
    monkeypatch.setattr(resource_probe, "snapshot", lambda _root: next(states))
    monkeypatch.setattr(resource_probe.os, "sysconf", lambda _name: 100)
    monkeypatch.setattr(resource_probe.time, "monotonic", lambda: clock[0])

    def advance(seconds: float) -> None:
        clock[0] += seconds

    monkeypatch.setattr(resource_probe.time, "sleep", advance)
    result = resource_probe.measure(2, 5, 5)
    assert result["cpuPercentOneCore"] == 20.0
    assert result["durationSeconds"] == 5.0
    assert result["rssMedianMiB"] == result["rssPeakMiB"] == 2.0
    assert result["departedProcesses"] == 1


def test_measurement_aborts_if_root_pid_is_reused(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    states = iter(
        [{(2, 2): Process(2, 1, 2, 100, 1)}, {(2, 99): Process(2, 1, 99, 10, 1)}]
    )
    monkeypatch.setattr(resource_probe, "validate_root", lambda _root: (2, 2))
    monkeypatch.setattr(resource_probe, "snapshot", lambda _root: next(states))
    monkeypatch.setattr(resource_probe.time, "sleep", lambda _seconds: None)
    with pytest.raises(RuntimeError, match="measurement aborted"):
        resource_probe.measure(2, 5, 5)


def test_measurement_aborts_if_root_changes_between_validation_and_first_sample(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(resource_probe, "validate_root", lambda _root: (2, 2))
    monkeypatch.setattr(
        resource_probe, "snapshot", lambda _root: {(2, 99): Process(2, 1, 99, 10, 1)}
    )
    with pytest.raises(RuntimeError, match="before measurement"):
        resource_probe.measure(2, 5, 5)
