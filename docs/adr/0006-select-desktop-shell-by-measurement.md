# 0006 — Select Electron as the desktop shell

Status: Accepted

Context: Svara needs a transparent, always-on-top, shaped XWayland window with reliable WebGL and
WebAudio on Ubuntu. Tauri 2 offers a smaller process and package footprint, but its Linux WebKitGTK
renderer carries material performance and driver risk. Electron ships a larger Chromium runtime but
has the more mature Linux GPU path. The selection rule in
[Desktop shell §1.3](../revamp/02-desktop-shell-and-ui.md#13-shell-choice-electron-accepted-after-measurement)
required Tauri to meet every threshold; otherwise Svara would use Electron.

Decision:

- Use Electron 44.x with React, TypeScript, and Vite for the v1 Ubuntu desktop shell.
- Keep `packages/avatar` framework- and shell-independent; Electron APIs stay behind a narrow,
  context-isolated preload bridge. Renderer windows stay sandboxed with Node integration disabled.
- Serve the packaged frontend from a privileged `svara://app` scheme, not `file://`, so CSP and the
  core's WebSocket origin allowlist have one stable application origin.
- Run the avatar window through XWayland by forcing Electron's X11 Ozone backend.
- Implement core-sidecar lifecycle, single-instance action forwarding, tray, autostart, and native
  menus in the Electron main process during T2.1 and related Phase 2 tasks.
- Keep the T0.5 Tauri measurements as historical evidence, but remove the Tauri wrapper and its
  Rust, WebKitGTK, GStreamer, and JavaScript dependencies from the active tree.
- Treat the high CPU observed in both candidates as unresolved renderer work, not as a waived
  production budget. T0.10 still gates XWayland correctness, and Phase 2/3 must profile the
  avatar-only production surface rather than the diagnostic spike page.

Consequences:

- Svara accepts Electron's larger installer and memory footprint in exchange for substantially
  better speaking-frame stability and a more predictable Chromium/WebGL path.
- The shell must manage the Python child process directly and package Electron with the `.deb`.
- No Rust toolchain, Tauri plugins, WebKitGTK runtime, or Tauri-specific frontend bridge is required.
- The current measurement harness remains development-only. Selecting its shell does not select its
  panel as product UI; the production idle surface remains avatar-only.

Evidence:

- [T0.5 Tauri measurements](../spikes/T0.5-tauri.md): idle 28.32 fps / 63.91% CPU; speaking
  52.53 fps with 66 drops / 129.18% CPU; approximately 498 MiB RSS.
- [T0.6 Electron measurements](../spikes/T0.6-electron.md): idle 29.90 fps / 64.40% CPU; speaking
  59.70 fps with 2 drops / 126.06% CPU; approximately 952.6 MiB RSS.
- Both candidates passed the available X11 transparency, shaped click-through, always-on-top, drag,
  and WebAudio checks. Neither met the absolute performance thresholds, but Tauri therefore failed
  the explicit all-criteria preference gate and Electron won under the predeclared fallback rule.
- XWayland on GNOME 46/50, Ubuntu 26.04 VM behavior, and NVIDIA remain recorded limitations for
  T0.10; they were not inferred from the X11 measurements.
