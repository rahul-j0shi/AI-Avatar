# Tauri shell spike

This is the T0.5 wrapper around the shared `@svara/avatar` page. It is deliberately isolated from
`apps/desktop/src-tauri`: T0.7 promotes the winning shell and deletes the losing wrapper.

The visible panel is a disposable measurement harness, not Svara's product UI. Production is
character-only while idle; transient interaction UI and separate Configure/Conversations windows
are specified in `docs/revamp/02-desktop-shell-and-ui.md` §2–3.

The reproducible build container is Ubuntu 24.04 with the official Linux prerequisites and stable
Rust. The app itself still opens on the host display, so window-manager behavior is measured against
the real session rather than a virtual framebuffer.

```bash
corepack pnpm --filter @svara/desktop spike:tauri:build-image
corepack pnpm --filter @svara/desktop spike:tauri:model # ignored, test-only VRM
GDK_BACKEND=x11 corepack pnpm --filter @svara/desktop spike:tauri
```

Use the controls to verify WebAudio and capture ten-second idle/speaking renderer samples. Native
drag starts from the avatar, and the Rust wrapper limits the X11 input shape to the avatar and panel
rectangles. The JSON report covers renderer timing; use `pidstat` or `ps` during each run for total
process CPU.

The downloaded model is pixiv's `VRM1_Constraint_Twist_Sample` at pinned three-vrm commit
`1b4fc0c`. Its embedded VRM metadata permits use, modification, and redistribution and does not
require attribution. It remains ignored because T0.12 selects and documents Svara's production CC0
avatar.
