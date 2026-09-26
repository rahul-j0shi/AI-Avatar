# 0006 — Select the desktop shell by measurement
Status: Proposed

Context: Tauri 2 provides a small package and native sidecar support, but its Linux WebKitGTK renderer
has material WebGL, transparency, XWayland, and proprietary NVIDIA risks. Electron ships a mature
Chromium path at the cost of package size and memory. Paper comparison cannot resolve the risks that
matter to Svara; the criteria are defined in
[Desktop shell §1.3](../revamp/02-desktop-shell-and-ui.md#13-shell-choice-tauri-2-with-electron-decided-by-measurement).

Decision:
- Build the same minimal `@svara/avatar` page in a Tauri 2 spike and an Electron spike.
- Measure idle CPU, speaking frame rate, dropped frames, transparency, click-through input regions,
  always-on-top behavior, dragging, WebAudio, and sidecar lifecycle.
- Use Ubuntu 24.04 on the primary Mesa machine for performance and Ubuntu 26.04 in a VM for
  functional compatibility; document NVIDIA as best-effort.
- Prefer Tauri only if it meets every threshold. Otherwise select Electron.
- Keep the React UI and renderer independent of both shells while this ADR is Proposed.

Consequences:
- Phase 0 carries the short-term cost of implementing two narrow spikes.
- Production shell work cannot begin until the evidence is recorded.
- The decision is based on reproducible behavior rather than package-size preference.
- Whichever shell loses is deleted after the shared UI has been preserved.

Evidence:
- T0.5 records the Tauri measurements.
- T0.6 records the Electron measurements.
- T0.7 compares the results, changes this ADR to Accepted with the chosen shell, and removes the
  losing spike.
