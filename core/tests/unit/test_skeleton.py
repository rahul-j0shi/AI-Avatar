"""Smoke test for the Phase 0 Python workspace."""

from svara_core import __version__


def test_core_package_is_importable() -> None:
    assert __version__ == "0.1.0"
