# Svara Desktop

The desktop surface hosts the React UI and `@svara/avatar` inside Electron. ADR-0006 selected Electron
after the measured Tauri and Electron spikes; production shell work begins in T2.1.

The retained measurement records are `docs/spikes/T0.5-tauri.md` and
`docs/spikes/T0.6-electron.md`. The losing Tauri wrapper was removed in T0.7. `electron/` is the
selected shell foundation; its current launcher still runs the development-only benchmark page.

The page currently under `src` is a **development-only shell benchmark**. Its panel, buttons, status
text and measurements are instrumentation, not the product design. The production desktop contract
is avatar-only while idle; it is specified in `docs/revamp/02-desktop-shell-and-ui.md` §2–3 and must
not import or expose this spike UI.
