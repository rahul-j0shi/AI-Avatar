# Svara Desktop

The desktop surface will host the React UI and `@svara/avatar`. Tauri and Electron shells are both
deferred to Spike A; the measured decision is recorded before either becomes the production shell.

The Tauri half of Spike A lives in `spikes/tauri`; its measured result is recorded in
`docs/spikes/T0.5-tauri.md`. T0.6 reuses the page in `src` for the Electron half.

The page currently under `src` is a **development-only shell benchmark**. Its panel, buttons, status
text and measurements are instrumentation, not the product design. The production desktop contract
is avatar-only while idle; it is specified in `docs/revamp/02-desktop-shell-and-ui.md` §2–3 and must
not import or expose this spike UI.
