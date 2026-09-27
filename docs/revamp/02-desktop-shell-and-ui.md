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
| **Position + always-on-top + drag** | The **avatar window runs through XWayland** (Electron forces `--ozone-platform=x11`). Mutter honours EWMH hints for X11 clients (`_NET_WM_STATE_ABOVE`, move requests, native app-region drag) | That Mutter 46 and 50 keep an XWayland window on top and at our position, and that drag works |
| **Click-through on transparent areas** | Apply Electron `BrowserWindow.setShape()` to the avatar silhouette box, bubble and popovers. Clicks outside the native shape pass through. **No cursor polling**, which wouldn't work anyway: under XWayland the global cursor position is stale while the pointer is over Wayland-native windows | That the shape updates cleanly when the bubble appears or disappears |
| **Global hotkeys** (Show/Hide, Stop, push-to-talk) | Portable path for 24.04 *and* 26.04: register **GNOME custom keyboard shortcuts** (gsettings `custom-keybindings`) that run `svara --action toggle` / `--action stop` / `--action talk`. `toggle` and `talk` start Svara when it is not already running; otherwise the single-instance plugin forwards the action. Shortcuts are opt-in, rebindable and removable in Configure. The GlobalShortcuts portal (26.04) is a later improvement | Cold-start and running-instance behaviour; hotkey → action latency (< 200 ms after the app is ready) |
| **Screenshots of other apps** | **xdg-desktop-portal Screenshot** (`interactive=false`) through D-Bus from the core. GNOME asks the user once and remembers the grant in its permission store. An XWayland app using `mss` would only see X11 windows | Whether GNOME 46 and 50 remember the grant, and the capture latency |
| **Input control (computer use)** | **xdg-desktop-portal RemoteDesktop** (with ScreenCast for the screen), with `persist_mode` so the user consents once per grant. No `ydotool`/uinput (that needs root-level device access) | The consent flow and restore-token reuse on both releases |
| **Window list / active app / focus** | **AT-SPI** accessibility bus, spoken over D-Bus with `dbus-fast` (no PyGObject: it has no wheels and is awkward to bundle), which works on Wayland for GTK/Qt/Chromium/Electron apps. "Focus app X" = re-launch its `.desktop` entry (`gio launch`); GNOME brings a running single-instance app to the front. Arbitrary window raising is not possible on Wayland and is documented as a limitation | Coverage of common apps (Firefox, Chrome, VS Code, Files, Terminal) |
| **Clipboard** | Wayland only lets the **focused** client read the clipboard. `clipboard.read` works right after the user interacted with the avatar (it has focus). Otherwise the tool returns "copy the text, then click me" instead of failing silently. `clipboard.write` works | Read/write from the XWayland avatar window |
| **Fractional scaling** | XWayland windows can look blurry at 125%/150% scaling. Supported, tested setups: 100% and 200%. Fractional is best-effort, and a known limitation in the README | Visual check at 100/150/200% |
| **Tray icon** | Electron `Tray` + native `Menu`; Ubuntu's AppIndicator extension exposes it | — |
| **Launch at login** | The Electron main process creates/removes `~/.config/autostart/svara.desktop` after explicit opt-in | — |
| **Keeping the avatar out of screen shares** | Not possible on GNOME Wayland (there is no exclude-from-capture API). Our *own* screenshot tool hides the avatar for the capture frame instead. The README states that the avatar is visible in meetings, with a quick "Hide for 30 min" menu item | — |

### 1.3 Shell choice: Electron, accepted after measurement

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

**Spike method:** build Spike A **twice** (Tauri and Electron, the same `packages/avatar` page in
both) and choose by measurement on Ubuntu 24.04 and 26.04, on an Intel/AMD iGPU and on NVIDIA:

- **Measured on the primary dev machine: Ubuntu 24.04 + Intel/AMD (Mesa) graphics.** Ubuntu 26.04
  is checked functionally in a VM (GNOME 50, Wayland-only). VM graphics are not representative, so
  that check is correctness-only. **NVIDIA is not available for testing.** It is a documented,
  best-effort configuration (the env workaround in 01 §3a) and listed as a known risk.
- The idle avatar stays under 5% CPU at 30 fps, and speaking holds 60 fps without dropped frames.
- A transparent background with no black rectangle, click-through via input region, and
  always-on-top + drag under XWayland all work.
- WebAudio playback works in the renderer.

The predeclared rule was to prefer **Tauri** only if it met every criterion and select **Electron**
otherwise. T0.5 measured Tauri at 52.53 speaking fps with 66 drops; T0.6 measured Electron at 59.70
fps with 2 drops. Both missed the absolute CPU/frame gate, so Tauri was ineligible and ADR-0006
selected **Electron**. The high CPU remains an optimization requirement; it is not accepted as the
production baseline. The web UI and `packages/avatar` remain independent of the thin shell.

### 1.4 Audio on Ubuntu

- **Mic capture happens in the core, not Electron's renderer.** The core can target a named
  **PipeWire** node consistently with a `pw-record` subprocess (04 §1), keep VAD beside capture, and
  use the optional system echo-cancel source independently of Chromium permissions. The protocol
  still lets a remote surface stream mic audio (the browser extension will).
- **Echo cancellation for barge-in:** PipeWire's `libpipewire-module-echo-cancel` (the WebRTC
  engine) in **monitor mode** uses whatever the system is playing as the echo reference, so it
  cancels our renderer's playback without re-routing audio. Onboarding offers to install a drop-in
  config (`~/.config/pipewire/pipewire.conf.d/60-svara-echo-cancel.conf`, which creates an
  `svara-ec-source`) and restarts the user's PipeWire service with consent. The core captures from
  that source when present. **Fallback:** barge-in only with headphones, or "duck and gate" (a
  higher VAD threshold while speaking).
- **Playback** stays in Electron's renderer (WebAudio), because it must share the avatar renderer's
  clock (03 §5). Chromium's audio runtime ships with Electron; no WebKitGTK/GStreamer dependency is
  required.
- **Autoplay:** create and `resume()` the AudioContext on the first click or double-click on the
  avatar. The first turn is always started by a gesture.
- **Mic permission:** none for native apps on Ubuntu. PipeWire/pulse access is open to the user's
  session.

### 1.5 Permissions the app asks for (just in time, never all at startup)

| What | Needed for | How on Ubuntu |
|------|-----------|---------------|
| Screenshot | `screen.capture` tool | Screenshot portal: GNOME dialog on first use, remembered |
| Remote desktop | `input.*` computer-use tools | RemoteDesktop portal: consent dialog, remembered with a restore token |
| Keyboard shortcuts | Show/Hide, Stop and push-to-talk hotkeys | Writes GNOME custom shortcuts (gsettings) after the user clicks *Add*; each can be changed or removed |
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
| **Avatar** | transparent, frameless, always-on-top, skip-taskbar, not resizable, ~360×480 logical px | The 3D character; only transient speech/status, type-in and approval UI when the active task requires it |
| **Conversations** | normal window, opened from the menu, remembers size | Conversation list + full transcript (tool calls collapsed) |
| **Configure** | normal window with a modal feel (focus-grabbing, closes with Esc), opened from the menu | Settings panel, see §6 |

Only the Avatar window exists at startup. The other two are created on demand and destroyed on close,
so they cost nothing when unused.

**Production-surface invariant:** while idle, the desktop shows **only the character on a transparent
background**. There is no card, dialog, title bar, terminal, toolbar, stats panel, FPS counter, test
button or persistent status text around it. A speech bubble, approval prompt, error, tool chip or
type box may appear only while that interaction needs it, then disappears. Benchmark controls and
diagnostic measurements belong to development/spike builds and must be unreachable and absent from
the production bundle. Conversations and Configure are separate, ordinary windows opened only on
request; they are never embedded beside the avatar.

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
- **Right-click → native context menu** (Electron `Menu.popup()`, which looks native and needs no custom
  styling):
  - Talk (same as double-click)
  - Stop (visible only while busy: cancels the turn / computer-use loop)
  - Type a message… (opens the inline input under the avatar)
  - New conversation
  - Response mode ▸ Speak + bubble · Bubble only · Speak only
  - Mute microphone / Pause voice output (toggles)
  - Voice volume ▸ 100% · 75% · 50% · 25% · Mute
  - Conversations
  - Configure
  - Hide avatar (minimise to tray) / Hide for 30 min (useful before screen sharing)
  - Show on all workspaces
  - Quit Svara
- **Hide/minimise:** because the frameless avatar deliberately has no taskbar entry or title-bar
  button, "minimise" means hide the avatar window while Svara remains available from its tray icon.
  Restore it with tray *Show*, the Show/Hide shortcut, `svara`, `svara --action show`, or
  `svara --action toggle`. Hiding stops rendering (0 fps) but does not cancel a running turn.
- **Size:** `ui.avatar.scale` (0.5–2.0) resizes the window and the framing together. The window
  size is derived from the scale; it is not a fixed 360×480.
- **Visual states** so the user always knows what it's doing: listening (mic glow; the mic is
  *only* open while this glow or the speaking state with barge-in is on), thinking, speaking, acting
  (tool chip), awaiting approval (bubble), error (bubble + brief `sad`), booting/core down (greyed
  avatar + tooltip).
- **Tray icon** (Phase 2, because it is the recovery path if the avatar is hidden or off-screen): Show/Hide, Talk, Configure, Quit Svara, so the app stays reachable if the
  avatar is hidden.
- **Global hotkeys** (through GNOME custom shortcuts, §1.2): Show/Hide is available with the Phase 2
  desktop presence; **Stop** (suggested `Ctrl+Alt+.`) ships in Phase 4 together with desktop tools,
  because a kill switch must exist before the assistant can act; push-to-talk (suggested
  `Ctrl+Alt+Space`) ships with voice. Show/Hide and push-to-talk can cold-start Svara. All are opt-in,
  rebindable and removable in Configure.

### 3.1 Control and recovery contract

| Intent | Avatar/menu or tray | Keyboard | Terminal | Result |
|--------|---------------------|----------|----------|--------|
| Start / restore | Tray **Show** | Show/Hide | `svara` or `svara --action show` | Starts if needed, then shows the avatar |
| Talk | **Talk** | Push-to-talk | `svara --action talk` | Starts if needed, then listens |
| Minimise / hide | **Hide avatar** / tray **Hide** | Show/Hide | `svara --action hide` or `toggle` | Hides only the avatar; tray and core remain |
| Stop work | **Stop** | Stop | `svara --action stop` | Cancels the current turn and audio |
| Turn input off | **Mute microphone** | — | `svara --action mute-mic` | No listening until unmuted |
| Turn output down/off | **Voice volume** / **Pause voice output** | — | `svara --volume 0..100` / `--action pause-voice` | Changes playback level or temporarily suppresses speech |
| Settings | **Configure** | — | `svara --action configure` | Opens the separate Configure window |
| Fully stop | **Quit Svara** | — | `svara --action quit` | Shell and core exit; no background process remains |
| Do not start at login | Configure → Features | — | — | Removes Svara's autostart entry |
| Remove from computer | Advanced → **Remove my Svara data and integrations**, then Ubuntu Software | — | `svara --purge-user-data`, then `sudo apt purge svara` | Removes per-user data/integrations, then the package (F38) |

Mute, pause and volume are independent: muting closes microphone capture; pausing voice keeps the
saved response mode but temporarily answers in the bubble; volume controls playback from 0–100%.
None of these silently changes whether Svara launches at login.

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
| **Voice** | Voice input on/off, mic mute/source (echo-cancelled source recommended), STT provider, VAD sensitivity, voice output on/off, output volume/pause, TTS provider + voice + speed, preview button |
| **Avatar looks** | Monaco editor on `avatar.json` (schema-validated) with a live preview pane; import VRM file; reset to default (see 03) |
| **Persona** | Markdown editor for `persona.md` (name, personality, tone, do/don't) with a "test in bubble" button |
| **Skills** | List of installed skills (toggle each), "New skill" (template `SKILL.md`), editor, import from folder |
| **MCP servers** | Monaco editor on `mcp.json` (Claude-Desktop-compatible) + live status per server (connected, tools count, error) + per-server toggle |
| **Permissions** | Monaco editor on `permissions.json` + mode selector (read-only / ask / custom) + audit log table |
| **Features** | One switch per feature flag (voice input, voice output, lip sync, expressions, gestures, desktop tools, MCP, skills, bubble auto-hide, telemetry-to-local-log…) |
| **Shortcuts** | Add/change/remove Show/Hide, Stop and push-to-talk GNOME shortcuts; cold-start behaviour is explained |
| **Advanced** | Core logs, latency overlay toggle, open config folder, reset settings, remove current-user Svara data and integrations |

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
