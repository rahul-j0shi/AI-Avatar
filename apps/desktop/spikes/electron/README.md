# Electron shell spike

This is the T0.6 wrapper around the same `@svara/avatar` page and production Vite bundle measured in
T0.5. It is isolated from production shell code so T0.7 can promote the winner and delete the loser.

The visible panel is a disposable measurement harness, not Svara's product UI. Production is
character-only while idle; transient interaction UI and separate Configure/Conversations windows
are specified in `docs/revamp/02-desktop-shell-and-ui.md` §2–3.

```bash
corepack pnpm --filter @svara/desktop spike:tauri:model # once; shared ignored VRM
GDK_BACKEND=x11 corepack pnpm --filter @svara/desktop spike:electron
```

Electron uses a transparent, frameless, always-on-top, skip-taskbar `BrowserWindow`. Linux
`BrowserWindow.setShape()` limits drawing and input to the avatar and diagnostic-panel rectangles,
and CSS `-webkit-app-region: drag` provides native dragging from the avatar. The preload bridge is
context-isolated and exposes only shape updates and structured measurement logging.
