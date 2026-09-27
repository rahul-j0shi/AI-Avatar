# Electron shell

ADR-0006 selected Electron for Svara's Ubuntu desktop shell after the T0.5/T0.6 measurements. This
directory is the thin shell foundation that T2.1 will extend with the production window, core
sidecar lifecycle, single-instance CLI forwarding, tray, and autostart behavior.

The launcher currently runs the retained Spike A measurement page. Its visible panel is disposable
instrumentation, not Svara's product UI. Production is character-only while idle; transient
interaction UI and separate Configure/Conversations windows are specified in
`docs/revamp/02-desktop-shell-and-ui.md` §2–3.

```bash
corepack pnpm --filter @svara/desktop spike:model # once; ignored test VRM
corepack pnpm --filter @svara/desktop shell:probe
```

Electron uses a transparent, frameless, always-on-top, skip-taskbar `BrowserWindow`. Linux
`BrowserWindow.setShape()` limits drawing and input to the avatar and diagnostic-panel rectangles.
The non-focusable Linux window is override-redirect, so Chromium's CSS drag region does not move it;
the T0.10 probe instead pointer-captures the avatar and sends validated absolute positions through
the narrow preload bridge without polling the global cursor.

Default creation preserves the managed baseline. `SVARA_SPIKE_FOCUS_MODE=nonfocusable` opts into
the experiment above; it does **not** implement the production idle-focus contract. Above-state
and later keyboard focus were not proven together. Focus buttons report Electron state only,
not a passed typing test. See `docs/spikes/T0.10-ubuntu-integration.md`.

The preview binds only to 127.0.0.1 and refuses an already-serving port. Main accepts only that
origin, denies renderer navigation/new windows and validates shape/position IPC.

The completed measurements and remaining platform-coverage limitations are recorded in
`docs/spikes/T0.6-electron.md`. T0.10 performs the outstanding XWayland integration checks before
the production shell is considered platform-complete.
