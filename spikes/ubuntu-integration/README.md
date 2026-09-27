# T0.10 Ubuntu integration probe (not product code)

Status and fallbacks: [T0.10 evidence](../../docs/spikes/T0.10-ubuntu-integration.md).
Do not advance to T0.11 until the outstanding integration checks and foundation review are resolved.

## Read-only capabilities

```bash
uv run --project core python spikes/ubuntu-integration/capability_probe.py
```

Reads versions, portal interfaces, accessible app names and library availability. Commands time out
after five seconds; absent commands/services report unavailable. Presence is not functional proof.

## Optional microphone transport check

```bash
bash spikes/ubuntu-integration/echo_cancel_probe.sh --allow-microphone
```

Explicitly opts into brief microphone capture. Creates a uniquely named temporary PipeWire source,
counts and discards bytes (no audio file), and removes its client on exit. Does not install config or
restart PipeWire. Transport is **not an AEC quality pass**. The included drop-in is an uninstalled
candidate for T3.11, not a verified production configuration.

## Remaining interactive matrix

Run on Ubuntu 24.04/GNOME 46 **Wayland**, then Ubuntu 26.04/GNOME 50 **Wayland**. X11 and Docker do
not substitute. Get consent before portal capture/input, clipboard writes, microphone capture, or
changing shortcuts/scaling. Preserve/restore settings; never overwrite unrelated entries.

| Check | Evidence needed |
|---|---|
| XWayland shell | Window identity, transparency, above ordinary windows, exact position and drag |
| Dynamic shape | Add/remove transient region; underlying native Wayland app receives excluded clicks |
| Idle focus + typing | Other app retains keyboard input during idle clicks/drag; explicit Type accepts text |
| Screenshot | First/repeated consent, denial/cancel, latency; no saved screen content in evidence |
| RemoteDesktop | Device grant, stop, restore-token reuse/rotation, repeat prompt, denial/cancel |
| AT-SPI | Firefox/Chrome, Code, Files, Terminal: running names AND focused-app state |
| App activation | `gio launch` for each already-running app; record exceptions |
| GNOME shortcut | User-added nonreserved binding invokes harmless marker; event-to-dispatch timing, not human reaction time |
| CLI actions | Cold/warm Show/Talk/Toggle/Stop when real CLI exists at T2.1; not a Phase 0 product pass |
| Clipboard | Preserve/write/read/restore sentinel with consent; focused and unfocused behavior |
| Scaling | 100/150/200%, bounds, input shape, drag; record fractional blur |
| AEC | Mic + speaker-monitor links, capture bytes; separately test speaker self-interruption and fallback at T3.11 |

The automatic shortcut-mutating experiment was removed: synthetic Ctrl+Alt+F12 did not dispatch,
and the manual timer included human reaction time. There is no working `svara --action` probe yet.

For the explicit non-focusable experiment only:

```bash
SVARA_SPIKE_FOCUS_MODE=nonfocusable corepack pnpm --filter @svara/desktop shell:probe
```

Default remains the managed shell baseline. Neither mode satisfies the complete product contract.
