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
  - Type a message… (opens the inline input under the avatar)
  - Response mode ▸ Speak + bubble · Bubble only · Speak only
  - Mute microphone / Pause voice output (toggles)
  - Conversations
  - Configure
  - Hide for 30 min / Show on all workspaces (nice-to-have)
  - Exit
- **Tray icon** (optional, Phase 6): Show/Hide, Configure, Exit, so the app stays reachable if the
  avatar is hidden.
- **Global hotkey** (optional, Phase 6): push-to-talk, e.g. `Ctrl+Alt+Space`.

## 4. Speech bubble (not a chat window)

- Shows **only the current exchange**. Assistant text streams in as it is generated (or in step with
  speech in *speak* modes, highlighting the spoken span). It fades out N seconds after the turn ends.
  Hovering keeps it open.
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

## 8. Accessibility & polish

These are cheap to do and they show in a portfolio:

- Respect `prefers-reduced-motion` (reduce idle sway, no bounce).
- Captions: the bubble is also the caption track when voice output is on.
- Keyboard: every menu action has a shortcut. Configure is fully keyboard-navigable.
- Frame budget: the renderer caps at 30 fps when idle and not hovered, and 60 fps while speaking. It
  pauses when the avatar is hidden. Battery matters for an always-on app.
