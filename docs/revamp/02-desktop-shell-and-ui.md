# 02 — Desktop shell & UI

## 1. Platform and shell

### 1.1 Target platform: Ubuntu only (v1)

| | Ubuntu 24.04 LTS | Ubuntu 26.04 LTS |
|--|------------------|------------------|
| Desktop | GNOME 46 | GNOME 50 |
| Default session | Wayland (an Xorg session still exists) | **Wayland only**: the GNOME Xorg session was removed; X11 apps run through **XWayland** |
| GlobalShortcuts portal | No (it arrived in GNOME 48) | Yes |
| Audio | PipeWire | PipeWire |

We design for **the default Wayland session on both releases**. We never ask the user to switch to
Xorg, because on 26.04 that option no longer exists. Other distros, macOS and Windows are post-v1. The
per-OS code sits behind small interfaces (window, screen, input, launcher), so ports are additive.

**Why this matters.** Wayland deliberately stops apps from doing the things a desktop pet needs.
A native Wayland window can't choose its own position, can't force itself above other windows (GNOME
has no layer-shell protocol), can't read the global cursor position, can't grab global hotkeys, and
can't screenshot or inject input into other apps without going through a portal. Each of these gets an
explicit decision below.

### 1.2 How each Wayland restriction is handled

| Need | Decision on Ubuntu (GNOME Wayland) | To verify in Spike A |
|------|-------------------------------------|----------------------|
| **Position + always-on-top + drag** | The **avatar window runs through XWayland** (`GDK_BACKEND=x11` for the avatar process). Mutter honours EWMH hints for X11 clients (`_NET_WM_STATE_ABOVE`, move requests, `_NET_WM_MOVERESIZE` drag) | That Mutter 46 and 50 keep an XWayland window on top and at our position, and that drag works |
| **Click-through on transparent areas** | Set a GTK **input shape region** (`gtk_widget_input_shape_combine_region`, which becomes an XShape input region) covering only the avatar silhouette box, the bubble and popovers. Clicks outside it pass through natively. **No cursor polling**, which wouldn't work anyway: under XWayland the global cursor position is stale while the pointer is over Wayland-native windows | That the input region updates cleanly when the bubble appears or disappears |
| **Global hotkeys** (Stop, push-to-talk) | Portable path for 24.04 *and* 26.04: register **GNOME custom keyboard shortcuts** (gsettings `custom-keybindings`) that run `ai-avatar --action stop` / `--action talk`. The single-instance plugin forwards the action to the running app. Onboarding adds them with consent and shows them in Configure. The GlobalShortcuts portal (26.04) is a later improvement | End-to-end latency of the hotkey → action (< 200 ms) |
| **Screenshots of other apps** | **xdg-desktop-portal Screenshot** (`interactive=false`) through D-Bus from the core. GNOME asks the user once and remembers the grant in its permission store. An XWayland app using `mss` would only see X11 windows | Whether GNOME 46 and 50 remember the grant, and the capture latency |
| **Input control (computer use)** | **xdg-desktop-portal RemoteDesktop** (with ScreenCast for the screen), with `persist_mode` so the user consents once per grant. No `ydotool`/uinput (that needs root-level device access) | The consent flow and restore-token reuse on both releases |
| **Window list / active app / focus** | **AT-SPI** accessibility bus, spoken over D-Bus with `dbus-fast` (no PyGObject: it has no wheels and is awkward to bundle), which works on Wayland for GTK/Qt/Chromium/Electron apps. "Focus app X" = re-launch its `.desktop` entry (`gio launch`); GNOME brings a running single-instance app to the front. Arbitrary window raising is not possible on Wayland and is documented as a limitation | Coverage of common apps (Firefox, Chrome, VS Code, Files, Terminal) |
| **Clipboard** | Wayland only lets the **focused** client read the clipboard. `clipboard.read` works right after the user interacted with the avatar (it has focus). Otherwise the tool returns "copy the text, then click me" instead of failing silently. `clipboard.write` works | Read/write from the XWayland avatar window |
| **Fractional scaling** | XWayland windows can look blurry at 125%/150% scaling. Supported, tested setups: 100% and 200%. Fractional is best-effort, and a known limitation in the README | Visual check at 100/150/200% |
| **Tray icon** | Ubuntu enables the AppIndicator extension by default, so the Tauri tray (libayatana-appindicator) shows up | — |
| **Launch at login** | `~/.config/autostart/ai-avatar.desktop` (`tauri-plugin-autostart`) | — |
| **Keeping the avatar out of screen shares** | Not possible on GNOME Wayland (there is no exclude-from-capture API). Our *own* screenshot tool hides the avatar for the capture frame instead. The README states that the avatar is visible in meetings, with a quick "Hide for 30 min" menu item | — |

### 1.3 Shell choice: Tauri 2, with Electron decided by measurement

Linux-only changes the comparison. Tauri's small size stays, but its webview on Linux is
**WebKitGTK**, which is Tauri's weakest platform. Under XWayland it can fall back to CPU-heavy
painting, and there are known blank-window and CPU problems with **NVIDIA proprietary drivers** (the
usual workaround is `WEBKIT_DISABLE_DMABUF_RENDERER=1`). Electron ships Chromium, whose GPU and WebGL
path on Linux is mature, at the cost of ~100+ MB and a Node runtime.

| | Tauri 2 (WebKitGTK) | Electron (Chromium) |
|--|--------------------|---------------------|
| Size / idle RAM | Small | Larger |
| WebGL + transparency on Linux | Risky (driver-dependent) | Mature |
| Input-shape click-through | Via `gtk_window()` in Rust | Via `setShape()` (X11) |
| Python sidecar | Built in (`externalBin`) | Manual `child_process` |
| Portfolio signal | Rust + modern | Common |

**Decision:** build Spike A **twice** (Tauri and Electron, the same `packages/avatar`
page in both) and choose by measurement on Ubuntu 24.04 and 26.04, on an Intel/AMD iGPU and on
NVIDIA:

- **Measured on the primary dev machine: Ubuntu 24.04 + Intel/AMD (Mesa) graphics.** Ubuntu 26.04
  is checked functionally in a VM (GNOME 50, Wayland-only). VM graphics are not representative, so
  that check is correctness-only. **NVIDIA is not available for testing.** It is a documented,
  best-effort configuration (the env workaround in 01 §3a) and listed as a known risk.
- The idle avatar stays under 5% CPU at 30 fps, and speaking holds 60 fps without dropped frames.
- A transparent background with no black rectangle, click-through via input region, and
  always-on-top + drag under XWayland all work.
- WebAudio playback works in the webview.

Prefer **Tauri** if it meets all of these, and pick **Electron** otherwise. Either way the web UI and
`packages/avatar` are identical, and only the thin shell differs.

### 1.4 Audio on Ubuntu

- **Mic capture happens in the core, not the webview.** WebKitGTK's `getUserMedia` depends on
  GStreamer plugins and its echo cancellation is uncertain. The core captures through **PipeWire**
  with a `pw-record` subprocess targeting a chosen node (04 §1) and runs VAD right next to it. The
  protocol still lets a surface stream mic audio (the browser extension will).
- **Echo cancellation for barge-in:** PipeWire's `libpipewire-module-echo-cancel` (the WebRTC
  engine) in **monitor mode** uses whatever the system is playing as the echo reference, so it
  cancels our webview's playback without re-routing audio. Onboarding offers to install a drop-in
  config (`~/.config/pipewire/pipewire.conf.d/60-ai-avatar-echo-cancel.conf`, which creates an
  `ai-avatar-ec-source`) and restarts the user's PipeWire service with consent. The core captures from
  that source when present. **Fallback:** barge-in only with headphones, or "duck and gate" (a
  higher VAD threshold while speaking).
- **Playback** stays in the webview (WebAudio), because it must share the renderer's clock (03 §5).
  The `.deb` depends on the GStreamer plugins WebKitGTK needs for audio. The Electron path doesn't
  need them.
- **Autoplay:** create and `resume()` the AudioContext on the first click or double-click on the
  avatar. The first turn is always started by a gesture.
- **Mic permission:** none for native apps on Ubuntu. PipeWire/pulse access is open to the user's
  session.

### 1.5 Permissions the app asks for (just in time, never all at startup)

| What | Needed for | How on Ubuntu |
|------|-----------|---------------|
| Screenshot | `screen.capture` tool | Screenshot portal: GNOME dialog on first use, remembered |
| Remote desktop | `input.*` computer-use tools | RemoteDesktop portal: consent dialog, remembered with a restore token |
| Keyboard shortcuts | Stop / push-to-talk hotkeys | Writes GNOME custom shortcuts (gsettings) after the user clicks *Add* |
| Echo cancellation | Barge-in on speakers | PipeWire drop-in config after the user clicks *Enable* |
| Autostart | Launch at login | Writes a `.desktop` file when the toggle is turned on |

If a grant is missing, the related plugin goes `pending: needs <grant>` with a button that starts the
flow. It never fails mid-turn.

**Frontend stack:** React 19 + TypeScript + Vite. We use no UI kit beyond a few headless primitives.
State is one small store (`zustand`) fed by protocol messages, and there is no Redux. Code editors in
the config panel use **Monaco** because it validates JSON Schema natively, which gives autocomplete for
permissions, MCP and avatar configs for free.

## 2. Windows

| Window | Properties | Contents |
|--------|-----------|----------|
| **Avatar** | transparent, frameless, always-on-top, skip-taskbar, not resizable, ~360×480 logical px | 3D avatar canvas, speech bubble, status ring, type-in box, approval bubbles |
| **Conversations** | normal window, opened from the menu, remembers size | Conversation list + full transcript (tool calls collapsed) |
| **Configure** | normal window with a modal feel (focus-grabbing, closes with Esc), opened from the menu | Settings panel, see §6 |

Only the Avatar window exists at startup. The other two are created on demand and destroyed on close,
so they cost nothing when unused.

## 3. Avatar window behaviour

- **Default position:** bottom-right of the primary monitor's *work area* (excluding the GNOME top
  bar and the Ubuntu dock), with a 16 px margin.
- **Drag:** `pointerdown` + move > 4 px → `appWindow.startDragging()`. On drop, save `{monitor id,
  x, y}` to `config.ui.avatar.position`. If that monitor is gone at next launch, fall back to the
  default.
- **Click vs double-click vs drag** are told apart by a small gesture recogniser (distance and time
  thresholds). A single click does nothing, so the avatar never triggers by accident.
- **Focus:** clicking the avatar would normally steal keyboard focus from the app you're working in.
  The avatar window is therefore **non-focusable by default** (X11 input hint `accept_focus=false`)
  and becomes focusable only while the type box or an approval bubble needs the keyboard. After that
  it gives focus up. Wayland doesn't let us hand focus back to the previous app explicitly, so this is
  best-effort and verified in Spike D.
- **Double-click → listen.** Toggles listening. The avatar shows a *listening* state (pose, glow, ear
  cue). A second double-click, a VAD end-of-speech or Esc stops it.
- **Click-through:** the window is bigger than the avatar (room for the bubble). The renderer reports
  the avatar's screen-space box, the bubble and any popover whenever they change. The shell sets the
  window's **input shape region** to exactly those rectangles (§1.2), so clicks anywhere else go to the
  app underneath. During a drag, the region is the whole window.
- **Right-click → native context menu** (Tauri `Menu::popup`, which looks native and needs no custom
  styling):
  - Talk (same as double-click)
  - Stop (visible only while busy: cancels the turn / computer-use loop)
  - Type a message… (opens the inline input under the avatar)
  - New conversation
  - Response mode ▸ Speak + bubble · Bubble only · Speak only
  - Mute microphone / Pause voice output (toggles)
  - Conversations
  - Configure
  - Hide for 30 min (useful before screen sharing) / Show on all workspaces
  - Exit
- **Size:** `ui.avatar.scale` (0.5–2.0) resizes the window and the framing together. The window
  size is derived from the scale; it is not a fixed 360×480.
- **Visual states** so the user always knows what it's doing: listening (mic glow; the mic is
  *only* open while this glow or the speaking state with barge-in is on), thinking, speaking, acting
  (tool chip), awaiting approval (bubble), error (bubble + brief `sad`), booting/core down (greyed
  avatar + tooltip).
- **Tray icon** (Phase 2, because it is the recovery path if the avatar is hidden or off-screen): Show/Hide, Talk, Configure, Exit, so the app stays reachable if the
  avatar is hidden.
- **Global hotkeys** (through GNOME custom shortcuts, §1.2): **Stop** (e.g. `Ctrl+Alt+.`) ships in
  **Phase 4**, together with desktop tools, because a kill switch must exist before the assistant can
  act. Push-to-talk (e.g. `Ctrl+Alt+Space`) ships in Phase 6. Both are rebindable in Configure.

## 4. Speech bubble (not a chat window)

- Shows **only the current exchange**. Its text always comes from the segmenter's *cleaned* stream,
  so expression tags like `[happy]` never show. In *bubble only* mode it streams as text is generated.
  In *speak + bubble* mode it reveals text in step with speech using `word_spans`, so the bubble
  never runs ahead of the voice. It fades out N seconds after the turn ends, and hovering keeps it
  open.
- Code blocks and long lists are never spoken. The bubble shows a compact version with "…more".
- The user's own transcript shows briefly as a small ghost line above the bubble while listening, so
  you can see what the assistant heard.
- Long replies are truncated with "…more", which opens Conversations at that message.
- Tool activity shows as a one-line chip ("Reading ~/Downloads…"). Permission requests show as a bubble
  with **Allow once · Always allow · Deny** (see 06).
- Positioning flips: the bubble goes above the avatar by default and below or to the side if the
  avatar is near a screen edge.

## 5. Type-in box

A single-line input that appears under the avatar from the menu or a hotkey. Enter sends. Shift+Enter
adds a newline and grows the box up to 4 lines. Esc closes. It goes away after sending and the reply
goes to the bubble.

## 6. Configure panel

Left navigation plus content. **The exhaustive section list is 12 F08**; the table below is the
overview. Every section maps to one config file or subtree (see 08). Saves are
validated against the pydantic JSON Schema and applied live through the kernel (no restart).

| Section | Contents |
|---------|----------|
| **Models & accounts** | Providers list (add/remove, test connection), API keys (saved to keychain), model per role (`main`, optional `vision`), Claude effort, "Claude (your subscription)" status |
| **Voice** | Voice input on/off, mic source (echo-cancelled source recommended), STT provider, VAD sensitivity, voice output on/off, TTS provider + voice + speed, preview button |
| **Avatar looks** | Monaco editor on `avatar.json` (schema-validated) with a live preview pane; import VRM file; reset to default (see 03) |
| **Persona** | Markdown editor for `persona.md` (name, personality, tone, do/don't) with a "test in bubble" button |
| **Skills** | List of installed skills (toggle each), "New skill" (template `SKILL.md`), editor, import from folder |
| **MCP servers** | Monaco editor on `mcp.json` (Claude-Desktop-compatible) + live status per server (connected, tools count, error) + per-server toggle |
| **Permissions** | Monaco editor on `permissions.json` + mode selector (read-only / ask / custom) + audit log table |
| **Features** | One switch per feature flag (voice input, voice output, lip sync, expressions, gestures, desktop tools, MCP, skills, bubble auto-hide, telemetry-to-local-log…) |
| **Advanced** | Core logs, latency overlay toggle, open config folder, reset everything |

## 7. Frontend structure

```
apps/desktop/src/
├── main.tsx                 # routes by window label: avatar | conversations | configure
├── lib/core-client.ts       # WS client: typed send/receive, reconnect, binary audio frames
├── lib/store.ts             # zustand store derived from protocol messages
├── windows/avatar/          # AvatarWindow, Bubble, TypeBox, ApprovalBubble, gesture recogniser
├── windows/conversations/
└── windows/configure/       # one component per section
packages/avatar/src/         # AvatarRenderer, PerformancePlayer, IdleBehaviours, retarget (no React)
```

**Editing config files from the panel without losing your comments.** The config files are JSONC
and humans edit them. The panel therefore edits **text**, never a re-serialised object:

- Form controls (switches, dropdowns) apply a minimal text edit with `jsonc-parser`'s
  `modify` + `applyEdits` (the same library VS Code uses), which keeps comments and formatting.
- Code-editor sections send the whole text.
- The core validates, writes atomically, and returns either `ok` + the new config version, or
  errors with line/column, which Monaco shows as markers. Stale writes are rejected: each write
  carries the version it was based on (optimistic concurrency), so an editor open in the panel never
  overwrites a change made in a text editor meanwhile.

**What is out of scope for v1 UI:** UI translations (English only; strings are kept in one module so
translation is possible later) and light/dark themes beyond following the OS.

## 8. Accessibility & polish

These are cheap to do and they show in a portfolio:

- Respect `prefers-reduced-motion` (reduce idle sway, no bounce).
- Captions: the bubble is also the caption track when voice output is on.
- Keyboard: every menu action has a shortcut. Configure is fully keyboard-navigable.
- Frame budget: the renderer caps at 30 fps when idle and not hovered, and 60 fps while speaking. It
  pauses when the avatar is hidden. Battery matters for an always-on app.
