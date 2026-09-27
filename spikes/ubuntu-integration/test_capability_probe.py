import subprocess
from unittest.mock import patch

from capability_probe import atspi_applications, portal_capabilities, run


def test_missing_commands_and_timeouts_are_unavailable() -> None:
    for error in (FileNotFoundError("missing"), subprocess.TimeoutExpired("busctl", 5)):
        with patch("capability_probe.subprocess.run", side_effect=error):
            assert run("busctl").returncode != 0
            assert all(not item["available"] for item in portal_capabilities().values())


def test_empty_introspection_is_not_a_portal() -> None:
    with patch(
        "capability_probe.run",
        return_value=subprocess.CompletedProcess([], 0, "NAME TYPE SIGNATURE", ""),
    ):
        assert all(not item["available"] for item in portal_capabilities().values())


def test_failed_registry_is_not_available() -> None:
    with patch("capability_probe.output", side_effect=["('unix:path=/tmp/test',)", ""]):
        assert atspi_applications() == {"available": False, "applications": []}
