# 02 — Desktop shell & UI

## 1. Shell choice: Tauri 2 (Electron as fallback)

| | Tauri 2 | Electron |
|--|--------|----------|
| Install size / RAM | Small (system webview) | ~100+ MB, full Chromium |
| Transparent, frameless, always-on-top | Yes (macOS needs `macOSPrivateApi`) | Yes |
| Click-through on transparent pixels | `setIgnoreCursorEvents(bool)` with no "forward" option, so we poll the cursor from Rust and toggle it (the approach other Tauri desktop-pet apps use) | `setIgnoreMouseEvents(true, {forward:true})`, built in |
| WebGL consistency | Depends on OS webview: WebView2 (Win) good, WKWebView (mac) good, **WebKitGTK (Linux) weakest** | Identical everywhere |
| Sidecar process (Python core) | Built in (`externalBin`) | Manual `child_process` |
| Portfolio signal | Modern, Rust | Common |

**Decision:** Tauri 2. The frontend is plain web code talking to the core over WebSocket, so switching
the shell to Electron later touches only `src-tauri/` and about 5 shell calls. That swap is cheap
because the shell is kept dumb on purpose.

**Phase 0 spike (gate):** on every target OS, render a VRM at 60 fps in a transparent, frameless,
always-on-top window, with drag and click-through working. If Linux fails, either drop Linux from v1
or use Electron. (Open question 1.)

**What Spike A must also prove** (these are platform traps that break the product if found late):

| Trap | Why it matters | What to check / fallback |
|------|----------------|--------------------------|
| **Mic in the webview** | We capture audio in the webview (04 §1). WebView2 supports `getUserMedia` well. WKWebView needs `NSMicrophoneUsageDescription` in `Info.plist` and a media-permission handler. WebKitGTK needs media-stream enabled in its settings and a permission handler | Capture 10 s on each OS with echo cancellation on. **Fallback:** capture in the core with `sounddevice`, and turn barge-in off on that OS (no echo-cancellation reference there) |
| **Echo-cancellation quality** | Barge-in with laptop speakers depends on it | Play TTS and talk over it; measure false barge-ins. Fallback: barge-in only when headphones are detected, or "duck and gate" (a higher VAD threshold while speaking) |
| **Audio autoplay policy** | Webviews may block `AudioContext` until a user gesture | Create and `resume()` the AudioContext on the first click or double-click on the avatar. The first turn is always started by a gesture, so this is enough. Also configure the webview to allow autoplay where the API exists |
| **Wayland (Linux)** | Wayland doesn't let apps set their own absolute window position or force always-on-top, and global hotkeys need portals | v1 on Linux = **X11 / XWayland only** (`GDK_BACKEND=x11`), documented. Native Wayland is a post-v1 item |
| **macOS private API** | Transparent windows need `macOSPrivateApi: true`, which rules out the Mac App Store | Accepted: we distribute a direct `.dmg` |
| **Fullscreen apps & workspaces** | On macOS the avatar should stay visible on every Space and over fullscreen apps if the user wants | Window level + "visible on all workspaces" option. Default: *not* over fullscreen apps (games, presentations) |
| **HiDPI / mixed-DPI monitors** | Cursor poll and window positions mix physical and logical pixels | All geometry in physical pixels on the Rust side, converted once per monitor scale factor. Test on a 100% + 150% two-monitor setup |

**OS permissions the app needs** (asked just in time, never all at startup):

| Permission | Needed for | macOS | Windows | Linux (X11) |
|------------|-----------|-------|---------|-------------|
| Microphone | Voice input | TCC prompt (Info.plist string) | Privacy settings toggle | Usually none |
| Screen recording | `screen.capture` tool | TCC *Screen Recording*, requires an app restart after granting | None | None on X11 |
| Accessibility | `input.*` computer-use tools, reading window titles | TCC *Accessibility* | None | None on X11 |

The onboarding and the relevant feature toggles explain each one, deep-link to the OS settings page,
and show the current status. If a permission is missing, the related tool plugin goes `pending:
needs <permission>` instead of failing mid-turn.

**Keeping the avatar out of screenshots.** Our own `screen.capture` tool must not capture the
avatar. Setting `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows and
`NSWindow.sharingType = .none` on macOS excludes it from all captures. On Linux, hide the window for
the one frame of the capture. The same setting is offered to the user as "Hide avatar in screen
shares" (on by default, since people forget it's there during meetings).

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

- **Default position:** bottom-right of the primary monitor's *work area* (excluding the taskbar or
  dock), with a 16 px margin.
- **Drag:** `pointerdown` + move > 4 px → `appWindow.startDragging()`. On drop, save `{monitor id,
  x, y}` to `config.ui.avatar.position`. If that monitor is gone at next launch, fall back to the
  default.
- **Click vs double-click vs drag** are told apart by a small gesture recogniser (distance and time
  thresholds). A single click does nothing, so the avatar never triggers by accident.
- **Double-click → listen.** Toggles listening. The avatar shows a *listening* state (pose, glow, ear
  cue). A second double-click, a VAD end-of-speech or Esc stops it.
- **Click-through:** the window is bigger than the avatar (room for the bubble). A Rust task polls the
  cursor about 30 times a second. Over the avatar's screen-space bounds (reported by the renderer when
  it changes), the bubble or any open popover, the window takes clicks. Anywhere else,
  `set_ignore_cursor_events(true)` lets clicks pass through to the app underneath. During a drag,
  ignore is forced off.
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
  - Hide for 30 min / Show on all workspaces (nice-to-have)
  - Exit
- **Size:** `ui.avatar.scale` (0.5–2.0) resizes the window and the framing together. The window
  size is derived from the scale; it is not a fixed 360×480.
- **Visual states** so the user always knows what it's doing: listening (mic glow; the mic is
  *only* open while this glow or the speaking state with barge-in is on), thinking, speaking, acting
  (tool chip), awaiting approval (bubble), error (bubble + brief `sad`), booting/core down (greyed
  avatar + tooltip).
- **Tray icon** (optional, Phase 6): Show/Hide, Configure, Exit, so the app stays reachable if the
  avatar is hidden.
- **Global hotkeys:** **Stop** (e.g. `Ctrl+Alt+.`) ships in **Phase 4**, together with desktop
  tools, because a kill switch must exist before the assistant can act. Push-to-talk (e.g.
  `Ctrl+Alt+Space`) ships in Phase 6. Both are rebindable.

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

Left navigation plus content. Every section maps to one config file or subtree (see 08). Saves are
validated against the pydantic JSON Schema and applied live through the kernel (no restart).

| Section | Contents |
|---------|----------|
| **Models & accounts** | Providers list (add/remove, test connection), API keys (saved to keychain), model per role (`main`, optional `vision`), experimental Claude Code bridge status |
| **Voice** | Voice input on/off, STT provider + language, VAD sensitivity, voice output on/off, TTS provider + voice + speed, preview button |
| **Avatar looks** | Monaco editor on `avatar.json` (schema-validated) with a live preview pane; import VRM file; reset to default (see 03) |
| **Persona** | Markdown editor for `persona.md` (name, personality, tone, language, do/don't) with a "test in bubble" button |
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
├── windows/avatar/          # AvatarWindow, Bubble, TypeBox, ApprovalBubble, gesture recogniser, mic worklet
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
