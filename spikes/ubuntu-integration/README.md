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

## Managed input-hint candidate (2026-10-02)

```bash
SVARA_SPIKE_FOCUS_MODE=managed-hints corepack pnpm --filter @svara/desktop shell:probe
```

This opt-in experiment keeps the window managed and changes X11 `WM_HINTS.InputHint` plus
`WM_TAKE_FOCUS`, instead of using Linux `setFocusable`. Requires a C compiler and X11 development
headers (`libx11-dev`) for the spike only. The launcher builds the helper into a unique temporary
directory and cleans it up on success/error. It adds no Python/JS runtime dependency or production
native module. Unknown modes and a missing helper fail explicitly.

Idle creation uses `showInactive`. Click **Probe Type interaction** or **Probe approval interaction**
to explicitly enable keyboard input. Type accepts a harmless sentinel; Enter submits only its
character count. The synthetic approval executes no tool. Escape or Close restores the idle hint.
Native changes serialize, so a delayed open cannot overtake a close. The bridge accepts only the
owned renderer. The original focus-toggle controls remain for the earlier experiments; in this
mode they explain that `setFocusable` is not used.

### Optional automated X11 regression

Start the candidate with a loopback debugging endpoint in terminal 1:

```bash
SVARA_SPIKE_FOCUS_MODE=managed-hints corepack pnpm --filter @svara/desktop shell:probe --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223
```

Start the separate **owned test window** in terminal 2:

```bash
corepack pnpm --filter @svara/desktop exec electron ../../spikes/ubuntu-integration/focus_target.cjs --remote-debugging-address=127.0.0.1 --remote-debugging-port=9224
```

With both windows visible, run in terminal 3:

```bash
node spikes/ubuntu-integration/focus_check.cjs --allow-test-input
```

Requires `xdotool`, `wmctrl` and a display of at least 1120×800 for the fixture. It sends synthetic
clicks/keys only to the owned test windows;
avoid other desktop interaction until it finishes. It checks idle focus/real keyboard delivery,
60×35 px drag, Type, Escape, approval navigation, native above/hints, invalid input and queued
open/close. It restores test-window position, pointer and prior focus best-effort, including failure
cleanup. It temporarily positions the owned window inside the screen so a right-edge start cannot
make the WM clamp the drag and produce a false failure. No microphone, clipboard, screenshots of
other apps, portal grants or settings writes.
Close both windows/terminals afterward to stop their temporary debugging endpoints.

This regression refuses non-X11 sessions: X11's active-window query cannot establish which native
Wayland application has focus. On Wayland run the manual matrix against a **native Wayland** editor.
The 24.04 X11 result is evidence for this candidate, not a passed G-PRESENCE on either target release.

Native implementation reference:
[Xlib window-manager hints and protocols](https://xorg.freedesktop.org/archive/current/doc/libX11/libX11/libX11.html).

## Repeatable idle resource baseline

Start the candidate with the loopback debug argument shown above. Wait for the real ignored VRM to
load and startup to settle. Do not play speech or interact with the probe during each CPU sample.
No ONNX/STT models are loaded by this Electron-only run. Inspect the process list and use the
**main Electron PID** whose command ends in this repository's `apps/desktop/electron/main.cjs`:

```bash
pgrep -af 'electron/dist/electron .*electron/main.cjs'
uv run --project core python spikes/ubuntu-integration/resource_probe.py --pid MAIN_PID --duration 300 --interval 5
node spikes/ubuntu-integration/render_probe.cjs --allow-render-probe
```

Replace `MAIN_PID` with the inspected positive integer. The sampler refuses unrelated/renderer
roots, does not change process state and writes JSON to stdout only. It sums the main process and
live descendants, excluding the preview server, Python/core, unrelated apps and compositor. CPU is
percent of **one logical core**; RSS is an approximate sum that counts shared resident pages more
than once. The sampler uses PID/start-time identities, aborts if the root exits/reuses its PID and
reports sampled process departures. CPU after an exit between samples can be missed; never present
such a measurement as an exact acceptance pass. Newly discovered descendants contribute their
observed lifetime ticks. Processes born and gone entirely between samples are not observed.
Field definitions: [Linux `/proc/pid/stat`](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html).

For the hidden baseline, minimize **only the owned probe window** (inspect its client ID with
`wmctrl -l`, then `xdotool windowminimize CLIENT_ID`), wait for it to settle and repeat both commands.
Restore it afterward. The frame probe reports `document.hidden` plus a ten-second submitted-frame
sample from the existing diagnostic renderer. It records no screenshots or microphone audio.
Run it before/after the resource sample to check visibility, not continuously during CPU sampling.
No debug endpoint is enabled in a packaged production app by these scripts.

To exercise replacement/disposal on the same cached fixture, restore the owned window and run:

```bash
node spikes/ubuntu-integration/render_probe.cjs --allow-render-probe --replace-20
```

This replaces the real VRM twenty times through the diagnostic file input, then measures frames.
Repeat the resource sample after settling and compare RSS, retaining the before/after workloads.
It changes only the owned spike's in-memory avatar; no new asset download, config or disk write.
RSS alone cannot prove all GPU/heap resources were released; no forced garbage collection is used.

These are diagnostic-page baselines, not the final avatar-only UI, an implemented core budget,
presented-frame accuracy, 20-avatar leak evidence or Wayland acceptance. Record hardware, power
mode, scaling, lockfile/model hashes and workload next to the output; failed budgets stay failed.
