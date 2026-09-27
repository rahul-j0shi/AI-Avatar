from __future__ import annotations

import json
import os
import platform
import re
import subprocess
from pathlib import Path
from typing import Final

PORTAL_INTERFACES: Final = (
    "Screenshot",
    "RemoteDesktop",
    "ScreenCast",
    "GlobalShortcuts",
)
APP_DESKTOP_IDS: Final = {
    "Chrome": ("google-chrome.desktop", "com.google.Chrome.desktop"),
    "Files": ("org.gnome.Nautilus.desktop",),
    "Firefox": ("firefox.desktop", "firefox_firefox.desktop"),
    "Terminal": ("org.gnome.Terminal.desktop",),
    "VS Code": ("code.desktop",),
}
APPLICATION_DIRS: Final = (
    Path("/usr/share/applications"),
    Path("/var/lib/snapd/desktop/applications"),
    Path.home() / ".local/share/applications",
)


def run(*arguments: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            arguments, capture_output=True, check=False, text=True, timeout=5
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return subprocess.CompletedProcess(arguments, 1, "", str(error))


def output(*arguments: str) -> str:
    result = run(*arguments)
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def portal_capabilities() -> dict[str, dict[str, object]]:
    capabilities: dict[str, dict[str, object]] = {}
    for name in PORTAL_INTERFACES:
        result = run(
            "busctl",
            "--user",
            "introspect",
            "org.freedesktop.portal.Desktop",
            "/org/freedesktop/portal/desktop",
            f"org.freedesktop.portal.{name}",
        )
        text = result.stdout
        version_match = re.search(r"\.version\s+property\s+u\s+(\d+)", text)
        capabilities[name] = {
            "error": result.stderr.strip() if result.returncode else None,
            "available": result.returncode == 0
            and bool(re.search(r"^\.", text, re.MULTILINE)),
            "availableDeviceTypes": next(
                (
                    int(match.group(1))
                    for match in re.finditer(
                        r"\.AvailableDeviceTypes\s+property\s+u\s+(\d+)", text
                    )
                ),
                None,
            ),
            "version": int(version_match.group(1)) if version_match else None,
        }
    return capabilities


def atspi_applications() -> dict[str, object]:
    address_result = output(
        "gdbus",
        "call",
        "--session",
        "--dest",
        "org.a11y.Bus",
        "--object-path",
        "/org/a11y/bus",
        "--method",
        "org.a11y.Bus.GetAddress",
    )
    address_match = re.search(r"'([^']+)'", address_result)
    if not address_match:
        return {"available": False, "applications": []}
    address = address_match.group(1)
    children = output(
        "gdbus",
        "call",
        "--address",
        address,
        "--dest",
        "org.a11y.atspi.Registry",
        "--object-path",
        "/org/a11y/atspi/accessible/root",
        "--method",
        "org.a11y.atspi.Accessible.GetChildren",
    )
    if not children:
        return {"available": False, "applications": []}
    bus_names = sorted(set(re.findall(r"':\d+\.\d+'", children)))
    applications: list[str] = []
    for quoted_bus_name in bus_names:
        bus_name = quoted_bus_name.strip("'")
        name_result = output(
            "gdbus",
            "call",
            "--address",
            address,
            "--dest",
            bus_name,
            "--object-path",
            "/org/a11y/atspi/accessible/root",
            "--method",
            "org.freedesktop.DBus.Properties.Get",
            "org.a11y.atspi.Accessible",
            "Name",
        )
        name_match = re.search(r"<'([^']*)'>", name_result)
        if name_match and name_match.group(1):
            applications.append(name_match.group(1))
    return {"available": True, "applications": sorted(applications)}


def desktop_applications() -> dict[str, bool]:
    return {
        application: any(
            (directory / desktop_id).is_file()
            for directory in APPLICATION_DIRS
            for desktop_id in desktop_ids
        )
        for application, desktop_ids in APP_DESKTOP_IDS.items()
    }


def pipewire_capabilities() -> dict[str, object]:
    library_roots = (Path("/usr/lib"), Path("/usr/lib64"))
    modules = sorted(
        str(path)
        for root in library_roots
        if root.exists()
        for path in root.glob("**/libpipewire-module-echo-cancel.so")
    )
    webrtc = sorted(
        str(path)
        for root in library_roots
        if root.exists()
        for path in root.glob("**/libspa-aec-webrtc.so")
    )
    status = output("wpctl", "status")
    version_lines = output("pw-cli", "--version").splitlines()
    return {
        "echoCancelModules": modules,
        "running": "PipeWire" in status,
        "version": version_lines[-1] if version_lines else None,
        "webrtcAecLibraries": webrtc,
    }


def main() -> None:
    os_release = {
        key: value.strip('"')
        for line in Path("/etc/os-release").read_text(encoding="utf-8").splitlines()
        if "=" in line
        for key, value in (line.split("=", 1),)
    }
    x11_atoms = output("xprop", "-root", "_NET_SUPPORTED")
    report = {
        "atspi": atspi_applications(),
        "desktopApplications": desktop_applications(),
        "display": {
            "display": os.environ.get("DISPLAY"),
            "fractionalScalingFeatures": output(
                "gsettings", "get", "org.gnome.mutter", "experimental-features"
            ),
            "sessionType": os.environ.get("XDG_SESSION_TYPE"),
            "waylandDisplay": os.environ.get("WAYLAND_DISPLAY"),
            "x11AlwaysOnTopAtom": "_NET_WM_STATE_ABOVE" in x11_atoms,
            "x11MoveAtom": "_NET_MOVERESIZE_WINDOW" in x11_atoms,
        },
        "gnome": {
            "customKeybindings": output(
                "gsettings",
                "get",
                "org.gnome.settings-daemon.plugins.media-keys",
                "custom-keybindings",
            ),
            "shell": output("gnome-shell", "--version"),
        },
        "host": {
            "architecture": platform.machine(),
            "name": os_release.get("PRETTY_NAME"),
            "versionId": os_release.get("VERSION_ID"),
        },
        "pipewire": pipewire_capabilities(),
        "portals": portal_capabilities(),
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
