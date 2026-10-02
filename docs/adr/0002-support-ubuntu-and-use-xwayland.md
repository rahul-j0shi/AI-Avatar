# 0002 — Support Ubuntu and run the avatar window through XWayland
Status: Accepted

Context: GNOME Wayland deliberately prevents clients from positioning themselves, forcing
always-on-top state, reading the global pointer, or capturing and controlling other applications
without portals. Ubuntu 26.04 no longer offers a GNOME Xorg session, while Svara's character must be
positionable and draggable on both supported releases. The constraints and fallbacks are detailed in
[Desktop shell §1](../revamp/02-desktop-shell-and-ui.md#1-platform-and-shell).

Decision:
- Support Ubuntu 24.04 LTS and 26.04 LTS on their default GNOME Wayland sessions for v1.
- Run only the avatar window through XWayland and use EWMH/XShape facilities for positioning,
  always-on-top behavior, dragging, and transparent input regions.
- Use desktop portals for screenshots and input control, AT-SPI for application state, and GNOME
  custom shortcuts for the cross-release hotkey path.
- Keep OS-facing behavior behind narrow interfaces so other platforms can be added after v1.

Consequences:
- Svara does not require or recommend an Xorg session.
- macOS, Windows, and other Linux desktops are outside v1 support.
- Fractional XWayland scaling is best-effort, and Svara cannot hide itself from third-party screen
  sharing on GNOME.
- Window behavior depends on Mutter and must be checked on both target releases.

Evidence:
- T0.5 and T0.6 measure the window behavior in both candidate shells.
- [T0.10](../spikes/T0.10-ubuntu-integration.md) records partial X11 evidence and fallbacks.
  Both Wayland checks remain open. Non-focusable construction changes window management and is
  only an explicit experiment; the combined product focus contract is unresolved.
- 2026-10-02: the managed-input-hint candidate passed combined idle click/keyboard, drag, Type,
  Escape and keyboard approval on X11 without losing above/managed state. Both Wayland validations
  remain required before adopting it; [reproduction](../../spikes/ubuntu-integration/README.md).
