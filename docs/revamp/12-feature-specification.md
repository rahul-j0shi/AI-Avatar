# 12 — Feature specification (authoritative scope for v1)

This document is the **contract** for what desktop v1 does. Docs 01–10 explain *how* and *why*.
This one says *exactly what* each feature does, where it stops, and how we know it's done.

**Rules for using this document**

1. **If it isn't written here, it is not in v1.** Anything not listed under a feature's *In scope*
   is out of scope, even if it seems small. Adding scope means editing this document first.
2. When this document and another doc disagree, **this document wins**, and the other doc gets
   fixed.
3. Numbers here (limits, timeouts, defaults) are the v1 values. Changing one is a spec change, not
   an implementation detail.
4. Each feature has **acceptance criteria (AC)**. A feature is done when every AC passes, and not
   before.
5. "Configurable" means a key in a config file (08) that the Configure panel also exposes, unless it
   says "file-only".
6. [14 — Acceptance and integration plan](14-acceptance-and-integration.md) assigns every AC to a
   task and test ID, and specifies cross-feature behavior. Its additional regression cases cover
   the Behaviour, Limits and Errors sections too; passing only the numbered ACs is insufficient.
   Feature dependencies below describe runtime relationships, not build order; use 13's task DAG.

**Feature template:** Purpose · Behaviour · In scope · Out of scope · Config & defaults · Limits ·
Errors & edge cases · Depends on · Phase · Acceptance criteria.

---

## 0. Global boundaries

### 0.1 Target

- Ubuntu **24.04 LTS** and **26.04 LTS**, GNOME, default Wayland session, x86-64 only. The avatar
  window runs through XWayland.
- One user, one machine, one running instance.
- English UI. The assistant replies in the user's language (F22); lip sync is language-agnostic
  (F15). v1 is tested in English only.

### 0.2 Global non-goals for v1 (none of these will be built)

| Not in v1 | Why / where it might come later |
|-----------|---------------------------------|
| macOS, Windows, other Linux distros/desktops, ARM | Post-v1 ports behind the same interfaces |
| Native Wayland windows (no XWayland) | Post-v1, when GNOME offers the needed protocols |
| Browser extension | Next after v1 (10) |
| User accounts, sign-in, cloud sync, any server we host | Local-first by design |
| Telemetry or analytics of any kind | Privacy |
| Mobile apps | — |
| Multiple simultaneous avatars or personas | Post-v1 (switchable personas) |
| Long-term memory across conversations | Post-v1 (06 §7) |
| Wake word | Post-v1 |
| Realtime speech-to-speech models | Post-v1 (a separate pipeline plugin) |
| Avatar inventory, marketplace, publishing | Post-v1 (03 §2) |
| In-app 3D mesh editing or avatar creation | Use Blender/VRoid outside the app |
| Third-party Python plugins | Post-v1 (01 §3) |
| MCP resources, prompts, sampling, elicitation, OAuth | Post-v1; v1 is MCP *tools* only |
| Auto-update | Users install a newer `.deb` |
| Coqui TTS / a second speech runtime | Removed from v1 by user decision on 2026-10-02; Kokoro and the three planned cloud voices remain |
| Snap / Flatpak packaging | Sandboxes block the desktop tools |
| UI translation, custom themes | English UI; follows the OS light/dark setting |
| Offering a claude.ai login inside the app | Not allowed by Anthropic (05 §3) |
| LangGraph, a DI framework, Redux, microservices, a database server | Over-engineering check (11 §4) |

### 0.3 Feature index

| ID | Feature | Phase |
|----|---------|-------|
| F01 | App lifecycle | 2 |
| F02 | Avatar window | 2 |
| F03 | Context menu & tray | 2 |
| F04 | Assistant states & indicators | 2–4 |
| F05 | Speech bubble | 2–3 |
| F06 | Type box | 2 |
| F07 | Conversations window | 2 |
| F08 | Configure window | 2, 6 |
| F09 | Listening (mic, VAD) | 3 |
| F10 | Speech-to-text | 3 |
| F11 | Response modes | 3 |
| F12 | Text-to-speech & playback | 3 |
| F13 | Barge-in | 3 |
| F14 | Avatar model & looks | 2, 6 |
| F15 | Lip sync (performance engine) | 3 |
| F16 | Expressions & gestures | 3 |
| F17 | Idle behaviour | 2 |
| F18 | Lip-sync lab | 3 |
| F19 | Model providers & accounts | 1, 5 |
| F20 | Agent turn & loop | 1, 4 |
| F21 | Conversations & context | 1, 4 |
| F22 | Persona | 1 |
| F23 | Tool registry | 4 |
| F24 | Permissions, approvals & audit | 4 |
| F25 | Desktop tools | 4 |
| F26 | Computer use (experimental) | 4 |
| F27 | Stop / kill switch | 4 |
| F28 | MCP servers | 5 |
| F29 | Skills | 5 |
| F30 | Config files, hot reload & feature flags | 1 |
| F31 | Secrets | 1 |
| F32 | Storage, retention & export | 1, 6 |
| F33 | Local model downloads | 3 |
| F34 | Privacy & data egress | 4 |
| F35 | First-run onboarding | 6 |
| F36 | Diagnostics, logs & latency overlay | 1, 3, 6 |
| F37 | Demo mode (fake providers) | 1 |
| F38 | Packaging & distribution | 7 |
| F39 | Plugin kernel (developer-facing) | 1 |
| F40 | Core ↔ surface protocol (developer-facing) | 1 |

### 0.4 Feature flags (the master list)

A flag decides whether a plugin is **mounted** (08 §2). Every flag is live: toggling it applies
without a restart.

| Flag (`features.*`) | Default | Mounts / controls |
|---------------------|---------|-------------------|
| `voiceInput` | on | F09 mic + F10 STT |
| `voiceOutput` | on | F12 TTS + playback |
| `bargeIn` | on | F13 |
| `lipsync` | on | F15 viseme engine (off = mouth follows loudness only) |
| `expressions` | on | F16 expression cues |
| `gestures` | on | F16 gesture cues |
| `sentimentFallback` | on | F16 rule-based default expression |
| `desktopTools` | on | F25 (all groups; each group also has its own `enabled`) |
| `computerUse` | **off** | F26 |
| `mcp` | on | F28 (each server also has `enabled`) |
| `skills` | on | F29 (each skill also has `enabled`) |
| `bubbleAutoHide` | on | F05 auto-hide |
| `showOnAllWorkspaces` | on | F02 |
| `launchAtLogin` | off | F01 |
| `latencyOverlay` | off | F36 |

---

## F01 — App lifecycle

**Purpose.** Start, run and stop reliably, as one instance, with a recoverable core.

**Behaviour.**
- Launch (from the app grid, a terminal `svara`, or autostart) → the shell starts → the core
  starts (01 §3a) → the avatar appears in the `booting` state → `idle` once the core says hello.
- A second launch does not start a second app. It forwards its arguments to the running instance:
  - `svara` with no args shows the avatar if hidden.
  - `--action talk` behaves like double-click.
  - `--action stop` behaves like F27.
  - `--action show` unhides.
  - `--action hide` hides/minimises the avatar to the tray; `--action toggle` switches shown/hidden.
  - `--action mute-mic` toggles microphone mute; `--action pause-voice` toggles voice pause.
  - `--action configure` opens F08.
- `svara --volume N`, where `N` is 0–100, sets output volume without opening a window.
- With no running instance, `talk`, `show`, `toggle` and `configure` launch Svara and perform the
  action after the core is ready. `stop`, `hide` and `quit` return success without launching it;
  `mute-mic`, `pause-voice` and `--volume` update persisted settings without leaving a process
  running.
- Exit (menu, tray, or `--action quit`) → graceful shutdown (01 §3a).
- If the core crashes, the shell restarts it: 3 attempts with 1 s / 2 s / 5 s backoff, then shows
  "Core stopped — View logs / Restart" in the bubble.

**In scope:** single instance; the CLI actions listed; cold-start action delivery; autostart toggle
(`~/.config/autostart`); crash restart; graceful shutdown; `booting` state.

**Out of scope:** multiple instances or profiles; system-wide (all users) autostart; background
daemon without a window; remote control from another machine.

**Config & defaults:** `features.launchAtLogin` = off.

**Limits:** core ready (`hello`) ≤ 1.5 s on the dev machine, with no local models loaded;
shutdown completes ≤ 5 s.

**Errors & edge cases:**
- The core fails to start 3 times → "Core stopped" state; the tray still works.
- The config dir is unwritable → a blocking error dialog with the path.
- Stdin close (the shell died) → the core exits within 2 s.

**Depends on:** F40, F30.

**Phase:** 2.

**AC.**
1. Launching twice leaves one process tree, and the second launch shows the existing avatar.
2. `svara --action talk` starts listening in the running instance.
3. Killing the core process → the avatar recovers to `idle` automatically.
4. `kill -9` on the shell → no `svara_core` process remains after 2 s.
5. Autostart on → the avatar appears after the next login. Off → the file is removed.
6. With Svara stopped, `svara --action talk` launches exactly one instance and begins listening
   after readiness; the Show/Hide shortcut likewise cold-starts and shows it.
7. `svara --action quit` leaves no shell or core process; running it again while stopped is a
   successful no-op.

---

## F02 — Avatar window

**Purpose.** A small, always-on-top character on the desktop that never gets in the way.

**Behaviour.**
- A transparent, frameless, always-on-top XWayland window with no taskbar/dock entry.
- **Idle surface = character only.** Its transparent window contains no persistent panel, dialog,
  title bar, terminal, controls, statistics, debug text or opaque background. Only interaction-bound
  UI may appear transiently: F04 state cues, F05 bubbles/tool chips, F06 type input and F24 approval.
  Conversations and Configure are separate on-demand windows. Spike/benchmark controls never ship.
- **Default position:** bottom-right of the primary monitor's work area, 16 px margin.
- **Drag:** press + move > 4 px anywhere on the avatar body drags it. On release, the position
  (monitor id + x, y) is saved.
- **Restore:** saved position on the same monitor; if that monitor is gone, the default position.
  If the saved position is partly off-screen, it is clamped into the work area.
- **Click-through:** only the avatar's bounding box, the bubble and open popovers receive clicks;
  everything else in the window passes clicks through (input shape region, 02 §1.2).
- **Focus:** non-focusable, except while the type box (F06) or an approval bubble (F24) is open.
- **Scale:** `ui.avatar.scale` from 0.5 to 2.0 (step 0.1) resizes the window and the avatar together.
- **Hide/minimise:** hides the avatar indefinitely while the tray and core remain. It returns through
  tray *Show*, the Show/Hide shortcut, `svara`, `--action show` or `--action toggle`.
- **Hide for 30 min:** the same hidden state with a timer. It returns after 30 min or by any restore
  path above.
- Hiding closes any mic capture (discarding an unfinished utterance) and disables barge-in while
  hidden. Already-playing speech may continue; Hide is not Stop. A pending approval retains its
  deadline and denies on timeout. Timer/restore semantics are in 14 §3.1.
- **Show on all workspaces:** the avatar is visible on every GNOME workspace (sticky).
- **Frame rate:** 30 fps when idle and not hovered, 60 fps while speaking, 0 fps while hidden.
- `prefers-reduced-motion` → sway and bounce are disabled; blinking and lip sync remain.

**In scope:** everything above, including the avatar-only production surface and every restore path.

**Out of scope:** resizing by dragging edges; multiple avatars; docking or snapping to edges; showing
over fullscreen apps (it may be covered by them); hiding from screen shares (impossible on GNOME
Wayland, 02 §1.2); click-through on per-pixel alpha (we use rectangles).

**Config & defaults:** `ui.avatar.scale` = 1.0; `ui.avatar.position` = null (the default spot);
`features.showOnAllWorkspaces` = on.

**Limits:** idle CPU (renderer + shell) < 5% of one core at 30 fps on the dev machine; speaking
holds 60 fps.

**Errors & edge cases:**
- Monitor unplugged while running → the avatar moves to the default position on the primary
  monitor.
- A WebGL context is lost → the renderer re-initialises once, and after a second loss shows a static
  image with a "rendering unavailable" tooltip.

**Depends on:** F14, F17.

**Phase:** 2.

**AC.**
1. A fresh install shows the avatar bottom-right on the primary monitor.
2. After dragging and restarting, the avatar is at the dragged position.
3. Clicking a window underneath, in the transparent area next to the avatar, activates that window.
4. Typing in another app continues uninterrupted after double-clicking the avatar.
5. Scale 2.0 and 0.5 both render without clipping.
6. The measured idle CPU meets the limit.
7. An idle production build screenshot contains only the rendered character over transparent pixels;
   no spike panel, terminal, statistics, test controls or persistent speech box exists in its DOM or
   application menu.
8. Hide stops rendering and removes the avatar window; tray Show, the shortcut and both CLI restore
   paths each bring the same instance back.

---

## F03 — Context menu & tray

**Purpose.** Every action is reachable in two clicks, and the app is always recoverable.

**Behaviour: right-click on the avatar opens a native menu**, in this order:

| Item | Shown when | Action |
|------|-----------|--------|
| Talk | always | = double-click (F09) |
| Stop | a turn is running | F27 |
| Type a message… | always | F06 |
| New conversation | always | F21 |
| Response mode ▸ Speak + bubble / Bubble only / Speak only | always | F11 (radio) |
| Mute microphone | `voiceInput` on | toggles mic availability (a checkbox) |
| Pause voice output | `voiceOutput` on | toggles speaking (a checkbox) |
| Voice volume ▸ 100% / 75% / 50% / 25% / Mute | `voiceOutput` on | sets F12 playback volume |
| Conversations | always | F07 |
| Configure | always | F08 |
| Hide avatar | always | minimises to the tray (F02) |
| Hide for 30 min | always | timed hide (F02) |
| Show on all workspaces | always | toggles F02 workspace behaviour |
| Quit Svara | always | fully exits (F01) |

**Tray (AppIndicator):** Show/Hide · Talk · Type a message… · Stop (while busy) · Configure · Quit Svara.

**In scope:** the items above, keyboard shortcuts shown in the menu, the tray.

**Out of scope:** custom-styled menus; user-defined menu items; recent-conversation submenus.

**Config & defaults:** `ui.micMuted` = false; `ui.voicePaused` = false;
`ui.outputVolume` = 1.0 (range 0.0–1.0).

**Errors & edge cases:** if the tray extension is disabled by the user, the menu still works, and
the README says how to re-enable it.

**Depends on:** F01, F02.

**Phase:** 2.

**AC.**
1. Every item performs its action.
2. Stop appears only while busy.
3. The tray Show brings back a hidden avatar.
4. Exit from the tray shuts down cleanly (F01 AC4-style check: no leftover processes).
5. Hide avatar removes only the avatar window, leaves the tray reachable and reduces its renderer to
   0 fps; restoring does not start a second core.
6. Volume choices, mic mute and voice pause show the correct checked state and survive restart.

---

## F04 — Assistant states & indicators

**Purpose.** The user always knows what the assistant is doing, and whether the mic is open.

**Behaviour.** The state machine is owned by the core (01 §4). Each state has one visual:

| State | Visual |
|-------|--------|
| booting | greyed avatar, tooltip "Starting…" |
| idle | normal idle behaviour (F17) |
| listening | mic glow ring + attentive pose; the transcript ghost line (F05) |
| thinking | gaze up/away, slower blink, small "…" chip |
| speaking | lip sync + bubble |
| acting | tool chip, e.g. "Reading ~/Downloads…" |
| awaiting_approval | approval bubble (F24) |
| error | error bubble + brief `sad` expression, then back to idle |

**Mic-open rule:** the mic stream is open **only** in `listening`, and in `speaking` when barge-in
is on. The glow ring is visible exactly when the mic is open.

**In scope:** the table above; the mic-open rule.

**Out of scope:** sounds or earcons for state changes; desktop notifications for state changes.

**Depends on:** F02, F05, F40.

**Phase:** 2 (visuals), 3 (mic), 4 (acting/approval).

**AC.**
1. Each state shows its visual within 100 ms of the `state` message.
2. The mic is closed (`pw-record` not running) whenever the glow is off. This is asserted in an
   integration test.

---

## F05 — Speech bubble

**Purpose.** Show the current exchange, never a chat history.

**Behaviour.**
- It shows the latest user utterance (a ghost line, max 2 lines, fades 3 s after the reply starts)
  and the assistant's current reply.
- **Text source:** the segmenter's *cleaned* stream (no tags, no reasoning).
- **Bubble only:** streams text as it is generated. **Speak + bubble:** reveals words in step with
  speech using `word_spans`.
- **Size:** max 8 lines at the current scale. Longer replies show the first 8 lines + "…more", which
  opens F07 at that message.
- **Code blocks** show as a single line "[code: N lines — open in Conversations]". Lists show at most
  5 items + "…more".
- **Auto-hide:** 8 s after the turn ends. Hovering pauses the timer. A click on the bubble keeps it
  open until the next click elsewhere.
- **Placement:** above the avatar; flips below or to the side near screen edges.
- Approval bubbles (F24) and error bubbles use the same component, with buttons.

**In scope:** the above.

**Out of scope:** Markdown rendering beyond bold/italic/inline code; images in the bubble; copy
buttons (use Conversations); history scrolling; reactions.

**Config & defaults:** `ui.bubbleHideAfterSec` = 8 (range 3–60); `features.bubbleAutoHide` = on.

**Errors & edge cases:** an empty reply → no bubble; a reply that is only a refusal shows the
refusal text.

**Depends on:** F04, F11.

**Phase:** 2 (text), 3 (sync with speech).

**AC.**
1. `[happy]` in model output never appears in the bubble.
2. In speak mode the bubble never shows a word more than 300 ms before it is spoken.
3. A 40-line reply shows 8 lines + "…more", and clicking it opens Conversations at that message.

---

## F06 — Type box

**Purpose.** Talk by typing.

**Behaviour.** Opened from the avatar menu or tray "Type a message…". A
single-line field under the avatar that grows to 4 lines. Enter sends, Shift+Enter adds a newline,
Esc closes. On send the box closes, and the input goes to F20 as `input.text`. The window becomes
focusable only while the box is open (F02).

**In scope:** plain text, up to 4,000 characters (a counter appears after 3,500).

**Out of scope:** attachments, drag-and-drop files, paste-an-image, slash commands, message
history recall (↑), autocomplete.

**Errors & edge cases:** while `awaiting_approval`, sending is blocked with the message "Answer the
permission request first".

**Depends on:** F20.

**Phase:** 2.

**AC.**
1. The typed text reaches the model unchanged.
2. Esc closes the box without sending.
3. 4,001 characters cannot be sent.

---

## F07 — Conversations window

**Purpose.** See the full history, which the bubble deliberately doesn't show.

**Behaviour.**
- A normal window. Left: the list of conversations (newest first), with title = the first user
  message truncated to 60 characters, and the date. Right: the transcript.
- **Transcript shows:** user messages, assistant messages (full Markdown), tool calls as collapsed
  rows (name, status, duration; expand to see arguments and a result preview of up to 2 KB),
  permission decisions, errors, and "interrupted" markers. Reasoning is hidden behind a collapsed
  "Reasoning" row when the provider returned any.
- **Actions:** search (a case-insensitive substring over message text), copy a message, export a
  conversation as Markdown, delete a conversation (with confirmation), "New conversation".
- Live: the active conversation updates while it is open.

**In scope:** the above.

**Out of scope:** continuing an older conversation (only the newest is active; post-v1); editing
messages, retrying or branching; full-text search ranking; exporting to other formats; token/cost
charts (usage is shown per turn as plain numbers).

**Config & defaults:** none.

**Limits:** the list shows all conversations (paged, 100 per page); a transcript loads lazily
(200 events per page).

**Depends on:** F21, F32.

**Phase:** 2.

**AC.**
1. A conversation with 3 tool calls shows 3 collapsed rows with correct statuses.
2. Search finds a word from a message 50 conversations back.
3. The exported Markdown contains every user/assistant message in order.
4. Deleting a conversation removes its events from SQLite.

---

## F08 — Configure window

**Purpose.** Change anything without editing files by hand (files still work).

**Behaviour.** A normal window with the left-nav sections below. Every change applies live through
F30. Form controls edit the JSONC text minimally (02 §7); editor sections edit the whole text with
schema validation and error markers. Saving is explicit (Ctrl+S or a Save button) in editor
sections and immediate for switches. A stale write is rejected with "the file changed on disk —
reload?".

| Section | Contents (v1, exhaustive) |
|---------|---------------------------|
| Models & accounts | F19: provider list, add/remove, API key entry (write-only), test connection, model per role, effort (Claude), subscription status |
| Voice | F09/F10/F12: mic mute, source, VAD sensitivity + end-silence, STT provider/model, TTS provider/voice/speed, output volume + pause, preview, echo-cancel setup (F13) |
| Avatar looks | F14: `avatar.json` editor + live preview, import `.vrm`, reset |
| Persona | F22: `persona.md` editor + "test in bubble" |
| Skills | F29: list with toggles, new/edit/delete/import |
| MCP servers | F28: `mcp.json` editor + per-server status and toggle |
| Permissions | F24: mode selector, `permissions.json` editor, "Always allow" list (`permissions.local.json`) with delete, audit log |
| Features | the 0.4 flag table as switches, plus every plugin's status (active / pending: reason / failed: reason / disabled) with *Retry* |
| Shortcuts | F01/F02/F27/F09: Show/Hide, Stop and push-to-talk bindings (GNOME custom shortcuts), add/change/remove; explains that Show/Hide and Talk also start Svara |
| Privacy | F34: the live "what leaves this machine" table |
| Advanced | schema-backed `config.json` editor for remaining settings (agent limits, language maps, etc.), logs, diagnostics bundle (F36), latency overlay toggle, model downloads (F33), history retention/clear (F32), settings export/import, open config folder, lip-sync lab (F18), reset settings, **Remove my Svara data and integrations** (F38) |

**Out of scope:** a settings search box; per-section undo history (the file is the source of truth;
use export for backups); remote configuration.

**Depends on:** F30, F31, F40.

**Phase:** 2 (Models, Persona, Shortcuts with Show/Hide), 3–4 (enable push-to-talk/Stop when their
features land), 6 (the rest and final shortcut polish).

**AC.**
1. Every switch change is visible in the file with its comments preserved.
2. An invalid JSON edit shows a marker at the right line and does not apply.
3. Editing the file in a text editor while the panel is open → the panel shows the new content
   within 1 s.

---
## F09 — Listening (mic, VAD)

**Purpose.** Capture exactly one user utterance, reliably and privately.

**Behaviour.**
- **Start:** double-click the avatar, menu *Talk*, tray *Talk*, the push-to-talk shortcut, or
  `--action talk`. The shortcut and CLI action cold-start Svara if needed. **Stop:** VAD
  end-of-speech, a second double-click, Esc (when focused), *Stop*, or no speech for 8 s.
- **Capture:** a `pw-record` subprocess on the selected PipeWire source, 16 kHz mono s16le, 20 ms
  frames. It prefers `svara-ec-source` if present.
- **Pre-roll:** the last 300 ms before speech onset is kept (ring buffer), so the first syllable
  isn't lost.
- **VAD:** Silero (ONNX model via onnxruntime; no PyTorch). Speech starts after ≥ 200 ms of voice probability above the threshold. Speech ends
  after `endSilenceMs` of silence.
- One utterance = one turn. Continuous conversation mode is out of scope.
- "Push-to-talk" in this plan means **press once to start, press again to stop**, not hold-to-talk.
  GNOME custom shortcuts invoke a command, not key-release events. Configure labels it "Talk
  (press to toggle)" and explains this; there is no background idle microphone for pre-roll.

**In scope:** the above; mic source selection; the mute toggle (F03).

**Out of scope:** wake word; continuous listening; speaker identification; noise suppression
beyond PipeWire's echo-cancel module; recording or storing audio (never stored by default).

**Config & defaults:** `stt.vad.endSilenceMs` = 700 (range 300–2000); `stt.vad.threshold` = 0.5
(0.3–0.8); `stt.noSpeechTimeoutSec` = 8; `audio.input.source` = auto.

**Limits:** max utterance 60 s (then it is cut and sent); frames are dropped only if the core stalls
for > 500 ms (logged).

**Errors & edge cases:**
- No source → the plugin goes `pending: no microphone found`, and double-click opens F06 with an
  explanation.
- The source disappears mid-utterance → the turn is cancelled with a message.
- Mic muted → Talk shows "Microphone is muted".

**Depends on:** F33 (Silero bundled), F04.

**Phase:** 3.

**AC.**
1. The first word of a sentence spoken immediately after the double-click is transcribed (pre-roll
   works).
2. Silence for 8 s after Talk → back to idle without a turn.
3. `pw-record` is not running in `idle`.
4. A 65 s monologue is cut at 60 s and still processed.

---

## F10 — Speech-to-text

**Purpose.** Turn the utterance into text through a swappable provider.

**Behaviour.** When the utterance is complete, the active STT adapter transcribes it. Streaming
providers also emit partials to the ghost line. The final transcript starts the turn. A noise
filter drops transcripts that are empty, under 2 characters, or below the confidence threshold
(when the provider reports one).
The threshold is 0.5 on normalized 0–1 confidence; missing confidence is not interpreted as zero.
Adapters document their score conversion, and noise fixtures cover providers without a score.

**In scope (adapters):** `faster_whisper` (local, default, model `small`, int8, CPU), `deepgram`
(cloud, streaming), `google_stt` (cloud, v2), `openai_stt` (cloud). Language auto-detect by default.

**Out of scope:** diarisation; punctuation or format options per provider; custom vocabularies;
GPU/CUDA setup (CPU only in v1; the int8 CPU path is the tested one); translating the speech.

**Config & defaults:** `stt.provider` = `faster_whisper`; `stt.model` = `small`; `stt.language` =
`auto`.

**Limits:** the local STT final for a 5 s utterance ≤ 1.0 s on the dev machine (measured in Phase 3
and then fixed as the regression bar).

**Errors & edge cases:** see 04 §4a (one retry, then a bubble message; audio is never stored).

**Depends on:** F09, F19 (secrets for cloud), F33.

**Phase:** 3.

**AC.**
1. Every adapter passes the shared STT contract tests (recorded fixtures).
2. A cough produces no turn.
3. Switching the provider in Configure applies to the next utterance with no restart.

---

## F11 — Response modes

**Purpose.** Let the user choose how the assistant answers.

**Behaviour.**

| Mode | Voice | Bubble text | Expressions |
|------|-------|-------------|-------------|
| Speak + bubble (default) | yes | synced to speech | yes |
| Bubble only | no | streamed | yes (timed to the text reveal) |
| Speak only | yes | hidden (except approvals and errors) | yes |

`Pause voice output` (F03) temporarily forces *Bubble only* without changing the saved mode.
`ui.outputVolume` applies to WebAudio playback in either speaking mode; 0 is silent but distinct from
pause, so raising it resumes audible playback without changing response mode.

**Out of scope:** per-conversation or per-app modes; automatic switching (e.g. when a meeting is
detected).

**Config & defaults:** `ui.responseMode` = `speak+bubble`; `ui.outputVolume` = 1.0 (0.0–1.0).

**Depends on:** F05, F12, F16.

**Phase:** 3.

**AC.** Each mode behaves as in the table; approvals always show a bubble in *Speak only*.

---

## F12 — Text-to-speech & playback

**Purpose.** Speak the reply with low latency and exact timing information for lip sync.

**Behaviour.**
- Sentences from the segmenter are synthesised one at a time, at most **2 ahead** of playback.
- A sentence is emitted when a terminator is followed by a space/newline and it has ≥ 4 words, or at
  a comma after 180 characters. The first sentence of a reply may be shorter (≥ 2 words) to start
  speaking sooner.
- Speech text normalisation: numbers, dates and common abbreviations are expanded; URLs become "a
  link"; file paths become "the file <name>"; code blocks are skipped; emoji are dropped.
- Audio (PCM) + the performance segment go to the avatar surface, which plays them gaplessly on one
  `AudioContext` (03 §5). A final gain node applies `ui.outputVolume` live without disturbing the
  playback/performance clock.

**In scope (adapters):** `kokoro` (local, default, our onnxruntime runner on the timestamped export, 03 §4.8), `elevenlabs` (cloud),
`azure_tts` (cloud), `openai_tts` (cloud).
The voice, speed (0.7–1.3) and `voicesByLanguage` map (03 §4.6).

**Out of scope:** voice cloning; SSML authoring; per-sentence emotion prosody control; sub-sentence
streaming (post-v1, 03 §3); output device selection (the system default is used).

**Config & defaults:** `tts.provider` = `kokoro`; `tts.voice` = the provider default; `tts.speed` =
1.0; `tts.defaultLanguage` = `en` (the G2P language for typed turns, 03 §4.6); `tts.voicesByLanguage` = {}.

**Limits:** local TTS first audio for a 10-word sentence ≤ 400 ms on the dev machine (measured, then
fixed as the regression bar).

**Errors & edge cases:** a TTS failure → that turn continues as *Bubble only* with a small chip
"voice unavailable".

**Depends on:** F15, F19 (secrets), F33.

**Phase:** 3.

**AC.**
1. Every adapter passes the TTS contract tests, including its declared alignment tier.
2. A 6-sentence reply plays with no gap > 150 ms between sentences.
3. A reply containing a URL speaks "a link".

---

## F13 — Barge-in

**Purpose.** Interrupt the avatar by speaking, like a person.

**Behaviour.** While `speaking` with barge-in on, VAD runs on the (echo-cancelled) mic. Voice
detected for > 250 ms → the current turn is cancelled, `performance.stop` stops playback within
100 ms, and a new listening turn starts with the pre-roll audio. The interrupted reply is kept
exactly as generated. The next user message is prefixed with "(You were interrupted after: '…')"
using the last fully spoken word (append-only rule, 05 §2a).

**Echo-cancel setup (part of this feature):** Configure → Voice → "Enable echo cancellation" writes
the PipeWire drop-in (02 §1.4) after confirmation and restarts the user's PipeWire service. "Remove"
deletes it and restarts again.

**In scope:** the above; typed input (F06) during speaking also interrupts.

**Out of scope:** "hold on" or backchannel detection (e.g. "mm-hm" not interrupting); resuming the
interrupted answer.

**Config & defaults:** `features.bargeIn` = on; `bargeIn.minSpeechMs` = 250.

**Errors & edge cases:** without the echo-cancelled source, barge-in uses a raised VAD threshold
while speaking (duck and gate), and the Voice section recommends headphones.

**Depends on:** F09, F12.

**Phase:** 3.

**AC.**
1. With laptop speakers and echo cancellation enabled, 10 minutes of the avatar talking produce 0
   self-interruptions.
2. Saying "stop" mid-sentence halts audio within 350 ms of speech onset.
3. The event log keeps the full interrupted reply, and the next user message carries the
   interruption note.

---

## F14 — Avatar model & looks

**Purpose.** A good-looking default avatar whose appearance is changed by editing `avatar.json`.

**Behaviour.**
- Default: the CC0 VRoid preset VRM (03 §1), shipped in the `.deb`.
- `avatar.json` fields (exhaustive for v1): `model`, `framing` (`height`, `offsetY`, `cameraFov`,
  `shot`: `bust` or `full`), `materials` (by name/glob: `color`, `emissive`, `opacity`), `meshes`
  (by name/glob: `visible`), `springBones` (`stiffness`, `gravity`, `wind`), `face`
  (`expressionIntensity`, `blink`, `gaze`), `idle` (`breathing`, `sway`, `animations`), `lipsync`
  (`profile`, `jawGain`, `smoothingMs`, `lookaheadMs`), `gestures` (name → `.vrma` path).
- Changes apply live (03 §2). Changing `model` reloads with a ~1 s cross-fade.
- **Import VRM:** copies a `.vrm` into the config dir, shows its embedded licence metadata, and
  refuses to apply looks edits if the licence forbids modification (with an explanation).

**Out of scope:** texture painting or uploading; attaching or removing meshes; blendshape editing;
creating avatars; non-VRM formats (ARKit-52 GLB is post-v1); an inventory UI.

**Config & defaults:** `avatar/avatar.json` shipped with the default model's tuned values.

**Limits:** VRM file ≤ 50 MB; import rejects larger files.

**Errors & edge cases:** an invalid `avatar.json` → the old look stays, and the error marker shows;
a missing model file → fall back to the default model with a warning.

**Depends on:** F30, F40 (`/assets`).

**Phase:** 2 (loading and framing), 6 (editor and import).

**AC.**
1. Changing a hair colour in `avatar.json` updates the avatar within 1 s without a reload.
2. Importing a VRM with "modification: prohibited" blocks looks edits and says why.
3. `assets/LICENSES.md` names the preset and its CC0 source.

---

## F15 — Lip sync (performance engine)

**Purpose.** Mouth shapes that match the audio closely enough to hold up in a close-up demo, in any
language.

**Behaviour.** As specified in 03 §3–§5: timing tiers A/B/D (C is post-v1 unless Spike B requires
it), IPA → 15 visemes, shape rules, amplitude envelope, retarget maps, coarticulation and smoothing in
the renderer. G2P: the espeak-ng subprocess for every language, Tier D for
anything uncovered.

**In scope:** retarget maps `vrm-basic` (default) and `vrm-extended` (used if the model has the
extra shapes); the tuning parameters in `avatar.json` `lipsync`.

**Out of scope:** ARKit-52 retarget (post-v1); ML audio-to-face models; tongue/teeth animation;
per-language hand-tuned viseme tables.

**Config & defaults:** `features.lipsync` = on; `lipsync.profile` = `vrm-basic`; `jawGain` = 1.0;
`attack` 35 ms / `release` 80 ms; `lookaheadMs` = 60.

**Limits:** viseme computation ≤ 30 ms per sentence (core); the renderer update ≤ 1 ms per frame.

**Errors & edge cases:** any engine failure falls back to Tier D; lip sync never delays audio.

**Depends on:** F12, F14.

**Phase:** 3.

**AC.**
1. The bilabial test (03 §7): every /p b m/ in 30 sentences closes the lips ≥ 40 ms within ±40 ms.
2. Audio-to-mouth offset < 45 ms, measured in the lab.
3. `features.lipsync` off → the mouth follows loudness only, with no errors.

---

## F16 — Expressions & gestures

**Purpose.** A face and body that react to what is said.

**Behaviour.**
- The model may emit inline tags: expressions `[happy] [sad] [angry] [surprised] [relaxed]
  [thinking]` with optional intensity `[happy:0.6]`, and gestures `[gesture:wave] [gesture:nod]
  [gesture:shrug]`.
- Tags are stripped from the text, turned into cues timed to the next word, and unknown tags are
  dropped silently.
- An expression lasts until the next expression cue or the end of the turn (then it eases back to
  neutral over 400 ms). Only one gesture plays at a time; a new gesture waits for the current one.
- **Sentiment fallback:** if a reply has no tags, a rule-based sentiment on each sentence sets
  `happy`/`sad`/neutral at intensity ≤ 0.4.
- State-driven poses (F04) blend underneath.

**In scope:** the 6 expressions, 3 gestures, the fallback, and the prompt section that teaches the
tags.

**Out of scope:** user-defined gestures via the UI (possible by adding `.vrma` files and editing
`avatar.json`, file-only); full-body locomotion; lip-synced singing; emotion detection from the
user's voice or face.

**Config & defaults:** `features.expressions` = on, `features.gestures` = on,
`features.sentimentFallback` = on, `face.expressionIntensity` = 0.8.

**Depends on:** F12 (timing), F14.

**Phase:** 3.

**AC.**
1. `[gesture:wave] Hi!` waves at the start of "Hi".
2. `[unknown]` produces nothing and is not shown.
3. A smile is reduced while a `PP` closure is active (no fighting shapes).

---

## F17 — Idle behaviour

**Purpose.** The avatar feels alive when nothing is happening, at negligible cost.

**Behaviour.** Always on, procedural: blinking (Poisson, mean 3.8 s, 15% double blinks), breathing,
micro-sway, saccades every 1–4 s, and gaze. Gaze follows the cursor only while the cursor is over the
avatar window; otherwise it looks at the viewer (03 §4.5). Optional idle `.vrma` clips from
`avatar.json`.

**Out of scope:** reacting to the active app or time of day; random idle speech; sleeping animations.

**Config & defaults:** `avatar.json` `face.blink`, `face.gaze`, `idle.*`.

**Depends on:** F14.

**Phase:** 2.

**AC.** Idle at 30 fps stays within F02's CPU limit; the blink interval distribution is tested.

---

## F18 — Lip-sync lab

**Purpose.** Tune and prove lip sync; it doubles as a portfolio showcase.

**Behaviour.** Configure → Advanced → Lip-sync lab:
- Enter text, choose the TTS provider/voice, and click Synthesise.
- Shows a timeline: waveform, phonemes, viseme keys, envelope and cues, with a play head.
- Playback at 1× / 0.5× / 0.25×, scrubbing, and A/B comparison of tiers A/B/D.
- Export the track as JSON (the golden-test format).

**Out of scope:** editing keyframes by hand; recording the user's own voice; video export (use a
screen recorder).

**Depends on:** F12, F15.

**Phase:** 3.

**AC.** A JSON export from the lab can be loaded as a golden test and passes.

---
## F19 — Model providers & accounts

**Purpose.** Use any mainstream LLM, with Claude via your subscription first.

**Behaviour.**
- **Providers (exhaustive for v1):**

| Provider id | Adapter | Auth | Notes |
|-------------|---------|------|-------|
| `claude_subscription` | AgentBackend (05 §3.2) | Your own installed Claude Code (`claude` on PATH), logged in by you in a terminal | Default when a logged-in Claude Code is detected |
| `anthropic` | ChatModel (05 §2a) | API key | Default model `claude-opus-5` |
| `openai` | `openai_compat` | API key | |
| `openrouter` | `openai_compat` | API key | |
| `ollama` | `openai_compat` | none (`http://localhost:11434/v1`) | Local |
| `lmstudio` | `openai_compat` | none (`http://localhost:1234/v1`) | Local |
| `custom_openai_compat` | `openai_compat` | optional key + `baseUrl` | Any compatible endpoint (DeepSeek, Groq, Together, vLLM, …) |
| `gemini` | `gemini` | API key | Phase 5 |

- **Roles:** `main` (required) and `vision` (optional; used for images when `main` lacks vision).
  `fallback` (optional) is used only when `main` is unreachable (04 §4a).
- **Model picker:** lists models from the provider's API (Anthropic Models API, `/v1/models`,
  Gemini list). Free-text entry is allowed for unlisted local models.
- **Test connection:** sends a 1-token request (or the subscription readiness query) and shows
  ok / the mapped error.
- **Claude effort:** `llm.effort` ∈ low | medium | high | xhigh | max, default `low` (applies to
  `anthropic`; ignored by others).

**In scope:** the table; roles; test; model listing; capability overrides for local models
(`tools`, `vision`, `maxContext`), file-only.

**Out of scope:** automatic routing between models by task; cost-based routing; fine-tuning;
embeddings; batch APIs; Bedrock/Vertex/Foundry clients; subscription bridges for other vendors;
per-conversation model choice.

**Config & defaults:** `llm.provider` = `claude_subscription` if detected, otherwise unset (onboarding
asks); `llm.model` = the provider default; `agent.maxOutputTokens` = 1024 (spoken replies are short).

**Errors & edge cases:** the mapped error types (04 §4a); a subscription that is not logged in →
`pending` with the exact terminal instruction; a provider without tool support → chat-only notice
(05 §2).

**Depends on:** F31, F30.

**Phase:** 1 (`claude_subscription` text-only, `anthropic`, `openai_compat`), 4 (subscription
tools), 5 (`gemini`).

**AC.**
1. All ChatModel adapters pass the shared contract suite (streaming, one tool call, parallel tool
   calls, image input, mid-stream cancellation, error mapping).
2. The subscription adapter passes its own contract tests (no built-in tools, no `~/.claude`
   settings loaded, streaming, our tools only).
3. Switching `llm.provider` in Configure takes effect on the next turn with no restart.

---

## F20 — Agent turn & loop

**Purpose.** Turn user input into a streamed reply, calling tools when needed, safely.

**Behaviour.**
- **Input → turn:** each `input.text` or final transcript starts a turn in the active conversation.
- **Turn policy:** new input while `thinking` / `speaking` / `acting` cancels the current turn and
  starts a new one. While `awaiting_approval`, typed input is blocked (F06) and spoken input is
  ignored.
- **Loop (ChatModel providers):** stream → collect tool calls → run them (F23/F24) → append the
  full assistant message and **one** user message with all results → repeat, until the model
  stops or `maxSteps` is reached (06 §1). History is append-only.
- **Loop (claude_subscription):** Claude Code runs the loop, and we provide tools (F23) and
  enforce permissions inside the handlers.
- **Step limit reached:** the assistant says it stopped after N steps and asks whether to continue;
  saying or typing "continue" starts a new turn.
- Independent read calls within one step may run concurrently. Mutating calls and approvals run
  one at a time, with permissions revalidated immediately before execution (14 §3.2).

**In scope:** the above; `maxSteps`, `turnTimeoutSec`, token caps.

**Out of scope:** planning or sub-agents; background or scheduled tasks; multiple concurrent turns;
the assistant speaking without user input; self-reflection loops.

**Config & defaults:** `agent.maxSteps` = 8 (1–25); `agent.turnTimeoutSec` = 120 (30–600);
`agent.maxOutputTokens` = 1024.

**Errors & edge cases:** a timeout ends the turn with a message, and partial text is kept; a tool
exception is returned to the model as an error result, not a crash.

**Depends on:** F19, F21, F23, F24.

**Phase:** 1 (no tools), 4 (tools).

**AC.**
1. A fake-provider test with 3 parallel tool calls produces one results message with 3 results.
2. Typing during speaking cancels TTS and starts the new turn.
3. The 9th step never runs with `maxSteps` = 8.

---

## F21 — Conversations & context

**Purpose.** Keep a coherent conversation for an always-on assistant, within the model's context.

**Behaviour.**
- Exactly one **active** conversation. A new one starts after 30 min of inactivity, via the menu
  *New conversation*, or via F07.
- Context strategy per adapter (05 §2): server compaction + tool-result clearing for `anthropic`,
  windowing for others, Claude Code's own management for the subscription.
- Capabilities are checked for the selected model. If a context-management operation is unavailable
  or fails, stop **before** an over-budget request, retain the conversation, and offer *New
  conversation*. Never silently drop Anthropic history or switch to a billable provider. The
  300-turn test covers both supported compaction and this safe limit outcome.
- Volatile facts (date/time, and the focused app when F25 app tools are on) go into the turn, not
  the system prompt (07 §4).

**In scope:** the above.

**Out of scope:** long-term memory across conversations; summaries for non-Anthropic providers;
resuming an older conversation; importing chats from elsewhere.

**Config & defaults:** `agent.newConversationAfterMin` = 30 (5–1440).

**Depends on:** F32, F19.

**Phase:** 1, 4.

**AC.**
1. After 31 idle minutes the next message starts a new conversation (visible in F07).
2. A 300-turn scripted conversation never sends a request exceeding the context budget on any
   adapter; supported compaction/windowing continues, and an unavailable context strategy produces
   the explicit retained-history limit outcome above, not a malformed request.
3. For `anthropic`, the request log shows no edited earlier messages (the append-only check).

---

## F22 — Persona

**Purpose.** You define who the avatar is.

**Behaviour.** `persona.md` = Markdown body + optional frontmatter (`name`, `voice`, `speed`). The
body becomes the first system prompt section. Built-in rules that the persona can't remove:
brevity for speech, the tag syntax (F16), safety and untrusted-content rules (06 §5), and "reply in
the user's language unless the persona says otherwise".

**In scope:** one persona file; the editor with "test in bubble"; the name shown in the tray tooltip
and the Conversations title bar.

**Out of scope:** multiple personas or switching; persona marketplace; per-conversation personas.

**Config & defaults:** a shipped default persona (a friendly, concise desktop companion).

**Limits:** body ≤ 8 KB (warning above, hard limit 32 KB).

**Depends on:** F30.

**Phase:** 1 (file), 6 (editor).

**AC.**
1. Changing the persona name applies to the next turn.
2. A persona that says "always reply in French" overrides the input-language rule.

---

## F23 — Tool registry

**Purpose.** One place where every tool lives, whatever its source.

**Behaviour.** Tools come from four sources: built-in desktop tools (F25), MCP servers (F28), skills'
`skills.load` (F29), and surface tools (the clipboard, F25). Each has a `ToolSpec` (06 §2):
- name: `<group>.<action>`, or `mcp.<server>.<tool>` for MCP;
- JSON Schema input;
- `capability`, `effect`, and a resource extractor.

The list offered to the model excludes tools that are denied in every case by the current
permissions. Tool results are capped at **32 KB** of text sent to the model (the full result goes to
the event log, itself capped at 1 MB per result) and images at 1 per result.

**Out of scope:** tool search or deferred loading (the v1 tool count is small); user-defined tools
without MCP; tool chaining DSLs.

**Limits:** max 128 tools offered per turn. Beyond that, MCP servers' tools are dropped in
alphabetical server order, with a warning in Features.

**Depends on:** F24.

**Phase:** 4.

**AC.**
1. Disabling an MCP server removes its tools from the next request.
2. A 1 MB tool output reaches the model as 32 KB + a truncation note.

---

## F24 — Permissions, approvals & audit

**Purpose.** Nothing happens on your machine unless the rules allow it. Read-only by default.

**Behaviour.** As specified in 06 §3:
- modes `read-only` (default) / `ask` / `trusted`;
- `deny` > `ask` > `allow` > mode;
- `capability(resource-glob)` rules;
- path normalisation;
- built-in denies (`~/.ssh`, `**/.env`, `/proc`, `/sys`, `/dev`, `/media/$USER`, the app's own
  config dir for writes).

**Approval bubble:** what/where + **Allow once · Always allow · Deny**. The timeout is 60 s, and a
timeout counts as Deny.
- "Always allow" writes an exact-resource rule to `permissions.local.json`.
- The Permissions section lists those rules and can delete them.
- Buttons only, never voice.

**Taint rule:** after any untrusted content enters the turn (a file read, a screenshot, an MCP
result), a write/exec call that the rules would allow is escalated to ASK.

**Audit log:** every decision (time, tool, resource, decision, matching rule, approver) is stored and
shown in Configure → Permissions.

**In scope:** the above.

**Out of scope:** per-app or per-time-of-day rules; approval by voice; remote approval; OS-level
sandboxing of tools or MCP servers (06 §6); per-skill permission grants.

**Config & defaults:** `permissions.json` `mode` = `read-only`; `approvalTimeoutSec` = 60 (15–300).

**Depends on:** F23, F40.

**Phase:** 4.

**AC.**
1. A table-driven test of ≥ 100 rule/call cases passes, including `..` traversal, symlinks into
   `~/.ssh`, and argv-injection attempts.
2. In read-only mode, `fs.write_file` is not offered to the model.
3. An approval timeout results in Deny, and the model is told it was denied.
4. Every decision appears in the audit log.

---

## F25 — Desktop tools

**Purpose.** Let the assistant read and act on your Ubuntu desktop, within hard limits.

**Behaviour: the exhaustive v1 tool list.**

| Tool | Capability / effect | Exact behaviour and limits |
|------|--------------------|----------------------------|
| `fs.list(path)` | `fs.read` / read | Entries of one directory: name, type, size, mtime. Max 500 entries (sorted by name; the rest counted). Hidden files are included only if `includeHidden=true` |
| `fs.read_file(path, offset?, length?)` | `fs.read` / read | Text is returned in pages of ≤ 32 KB (`offset`/`length` in bytes, UTF-8 safe); the result states the total size so the model can page. Files > 10 MB are refused. PDF → text of the first 50 pages, paged the same way. Images (png/jpg/webp) → downscaled to a 1568 px long edge and sent to a vision model. Anything else → "unsupported type" |
| `fs.search(root, name?, contains?)` | `fs.read` / read | Glob name match and/or case-insensitive text match in files ≤ 1 MB. Skips `.git`, `node_modules`, and hidden dirs unless asked. Max depth 8, max 200 results, stops after 10 s |
| `fs.write_file(path, text, mode)` | `fs.write` / write | `mode` = `create` (fails if the file exists) or `overwrite` (fails if it doesn't). UTF-8 text only, ≤ 1 MB. Parent dirs must exist. No append, no binary |
| `fs.move(src, dst)` | `fs.write` on both / write | Files or directories. Fails if `dst` exists. Same-filesystem moves only in v1 |
| `fs.trash(path)` | `fs.write` / write | freedesktop Trash (`gio trash`). **There is no delete tool** |
| `clipboard.read()` | `clipboard.read` / read | Text only, ≤ 64 KB; surface-provided; needs the avatar window focused (02 §1.2) |
| `clipboard.write(text)` | `clipboard.write` / write | Text only, ≤ 64 KB |
| `screen.capture(target)` | `screen.capture` / read | `target` = `primary` or `all`. Through the Screenshot portal; the avatar hides for the capture; PNG downscaled to a 1568 px long edge |
| `apps.list()` | `apps.read` / read | Installed apps from `.desktop` entries (name, id), max 300 |
| `apps.running()` / `apps.focused()` | `apps.read` / read | Through AT-SPI: running accessible apps; the focused app name + window title |
| `app.open(id or name)` | `app.open` / write | Launches via `gio launch`, which also brings a running app to the front. A fuzzy name match with more than one hit returns the candidates instead of guessing |
| `url.open(url)` | `url.open` / write | `http`, `https` and `mailto` only, via `xdg-open` |
| `notify(title, body)` | `notify` / write | Desktop notification through D-Bus; title ≤ 64, body ≤ 256 characters |
| `system.info()` | `system.read` / read | OS version, CPU/RAM usage, disk free, battery %, date/time |
| `shell.exec(argv, cwd?)` | `shell.exec` / exec | argv list, no shell. Env = a minimal allow-list (PATH, HOME, LANG). Timeout default 30 s, max 300 s. Output captured up to 1 MB (stdout + stderr); the model receives ≤ 32 KB (head + tail) per F23. No stdin, no background processes, no `sudo` (built-in deny) |

**Out of scope:** window management (move/resize/close other apps' windows, impossible on Wayland);
file deletion; binary file writing; network downloads; email/calendar access (use MCP); OCR (use a
vision model on a screenshot); controlling media players (use MCP); system settings changes; package
installation.

**Config & defaults:** `features.desktopTools` = on; per-group `enabled` (`fs`, `clipboard`,
`screen`, `apps`, `system`, `shell`); `shell` group **off** by default.

**Depends on:** F23, F24, F34 (the screenshot consent).

**Phase:** 4 (4a read tools → 4b act tools → 4c shell).

**AC.**
1. Each tool has unit tests for every limit in its row.
2. The Phase 4 demo script (09) passes end to end.
3. The avatar never appears in its own screenshots.

---

## F26 — Computer use (experimental)

**Purpose.** Let a vision model operate the GUI when no tool fits. Off by default.

**Behaviour.**
- Actions: `input.move`, `click` (left/right/double), `type` (text ≤ 1,000 characters), `key`
  (combos), `scroll`, plus a screenshot after each action.
- Through the RemoteDesktop + ScreenCast portals (02 §1.2).
- Anthropic models use the native computer-use tool; other vision models use our JSON action schema.

**Approval:** ASK once per turn to start controlling. The grant lasts for the current turn, capped at
**50 actions or 120 s**, whichever comes first.

**Guards:**
- A visible "controlling your computer" state.
- The Stop shortcut (F27).
- A blocklist of focused apps where input is always denied: password managers, GNOME Settings,
  terminals, and our own Configure window.
- Unknown/unavailable focused-app identity denies input too; losing the portal grant ends control.
- Every action is logged with a thumbnail.

**In scope:** the above, behind `features.computerUse`.

**Out of scope:** unattended or background control; control over multiple turns without asking
again; drag-and-drop gestures; games; OCR-based targeting without a vision model.

**Depends on:** F24, F25 (`screen.capture`), F27.

**Phase:** 4 (last).

**AC.**
1. Pressing the Stop shortcut during a 50-action run stops within 1 action.
2. Focusing a terminal during control → the next input action is denied.

---

## F27 — Stop / kill switch

**Purpose.** Instantly stop whatever the assistant is doing.

**Behaviour.** The Stop shortcut (a GNOME custom shortcut → `svara --action stop`), menu *Stop*,
or tray: cancels the turn's TaskGroup, stops audio, rejects pending approvals, and ends a computer-use
grant. The state goes to `idle`, and the bubble says "Stopped."

**Out of scope:** undo of completed actions (the audit log shows what happened; trash is
recoverable).

**Config & defaults:** the default binding `Ctrl+Alt+.`, set up in onboarding or Configure →
Shortcuts.

**Limits:** from the key press to audio silence and no further tool calls ≤ 300 ms.

**Depends on:** F01 (CLI action), F20.

**Phase:** 4.

**AC.** Pressing the shortcut mid-tool-loop → no new tool execution starts after cancellation is
received, within the 300 ms key-to-stop bound. Completion/audit records for already-started actions
are retained and labeled; Stop does not pretend to undo them.

---

## F28 — MCP servers

**Purpose.** Add external tools without writing code.

**Behaviour.**
- `mcp.json` in the Claude Desktop `mcpServers` format.
- Transports: stdio and streamable HTTP.
- Each server is a plugin: connect → list tools → register them as `mcp.<server>.<tool>` →
  re-register on `tools/list_changed`.
- Status per server: connecting / connected (N tools) / error (last 20 stderr lines).
- `${secret:name}` in `env`/`headers` is resolved from the keychain.
- Spawn PATH = the login-shell PATH (07 §1).
- Adding a server shows a one-time trust warning with the exact command.

**Out of scope:** MCP resources, prompts, sampling, elicitation, roots; OAuth for remote servers;
installing servers from a catalogue; SSE transport (unless a server requires it, then post-v1);
sandboxing servers.

**Config & defaults:** no servers by default; per-server `enabled`, `timeoutSec` (default 60),
`connectTimeoutSec` (default 20).

**Limits:** tool results follow F23's caps; a crashed stdio server is restarted at most 3 times, then
marked `error`.

**Default permission:** `mcp.*` tools are ASK unless allowed by a rule (the `readOnlyHint`
annotation is shown but not trusted).

**Depends on:** F23, F24, F31.

**Phase:** 5.

**AC.**
1. Pasting a working Claude Desktop config makes its tools callable with no restart.
2. Toggling a server off kills its process and removes its tools.
3. A missing `npx` shows "npx not found — install Node.js".

---

## F29 — Skills

**Purpose.** Teach the assistant procedures in the open Agent Skills format, including ones you write
in the app.

**Behaviour.**
- A skill is a folder `skills/<name>/SKILL.md` (frontmatter `name`, `description`) plus optional
  files.
- Only `name` + `description` of enabled skills are in the prompt. The model calls
  `skills.load(name)` to get the body and a file list, and reads files with `fs.read_file`
  (subject to F24).
- Scripts run only through `shell.exec`.
- In-app: New (template), edit, delete, enable/disable, and import from a folder (copied; starts
  disabled and marked "review before enabling").

**Out of scope:** a skill marketplace; zip import; assistant-authored skills (post-v1); `allowed-tools`
permission effects (ignored in v1); skill versioning.

**Config & defaults:** no skills by default (one example skill ships disabled as a template).

**Limits:** `name` ≤ 64 characters (lowercase, digits, hyphens); `description` ≤ 1,024 characters;
`SKILL.md` ≤ 64 KB; max 50 enabled skills.

**Depends on:** F23, F24, F30.

**Phase:** 5.

**AC.**
1. A new skill written in the app is used by the model in the next turn.
2. An imported skill is disabled until enabled.
3. Invalid frontmatter shows a marker and doesn't mount.

---
## F30 — Config files, hot reload & feature flags

**Purpose.** Everything is configurable, live, from files or the panel.

**Behaviour.** The files and locations are in 08 §1 (`$XDG_CONFIG_HOME/svara/`). JSONC with
`$schema`, validated by pydantic-generated JSON Schemas. A change (file watcher or panel) is
validated, then the plugin tree is diffed, and `mount`/`unmount`/`reconfigure` run only for changed
entries (01 §2.3).
- Invalid → the old config is kept and the error shown.
- Content-hash dedupe; atomic writes; `version` + migrations with a backup (08 §4a).
- Every plugin entry accepts `enabled`, and the flags are in 0.4.

**In scope:** the above; first-run default files with comments.

**Out of scope:** remote or managed configuration; config profiles; environment-specific overlays;
YAML/TOML.

**Limits:** a valid change is applied ≤ 1 s after the file is saved.

**Depends on:** F39.

**Phase:** 1.

**AC.**
1. Toggling any 0.4 flag in the file applies within 1 s without a restart.
2. A syntax error keeps the app running on the old config with a visible error.
3. A v1→v2 migration test upgrades a sample config and writes a `.bak`.

---

## F31 — Secrets

**Purpose.** API keys never sit in plain files.

**Behaviour.** Keys are stored in the Secret Service (GNOME Keyring) under the service `svara`,
and config holds `{"secret": "<name>"}` references. The panel is write-only and shows `••••last4`.
Credential files (Google service-account JSON) are stored as keychain blobs. Environment variables
(`ANTHROPIC_API_KEY`, …) work as a fallback, **except** for `claude_subscription`, whose child process
never receives them (05 §3.2).

**Out of scope:** a plaintext or encrypted-file fallback when the keyring is unavailable (the
provider goes `pending: keyring unavailable`); secret sharing; secret rotation reminders.

**Depends on:** F40 (`secrets.set`).

**Phase:** 1.

**AC.**
1. `grep` over the config dir finds no key material after entering a key.
2. `config.get` never returns a secret value.
3. A locked keyring → a `pending` status with an explanation, not a crash.

---

## F32 — Storage, retention & export

**Purpose.** A durable, auditable record of conversations and decisions.

**Behaviour.** SQLite (WAL) at `$XDG_DATA_HOME/svara/events.sqlite`, append-only events (08 §4);
one async writer; `user_version` migrations.

**Retention:** keep forever (default) / 30 / 90 days, applied daily. *Clear history* deletes all
conversations after confirmation.

**Exports:** a conversation → Markdown (F07); settings → zip of config + persona + skills (no
secrets, no DB); diagnostics (F36).

**Out of scope:** encryption at rest (it relies on the OS account and disk encryption); cloud
backup; importing conversations; storing audio.

**Depends on:** —.

**Phase:** 1 (log), 6 (retention, exports).

**AC.**
1. Killing the core mid-turn never corrupts the DB (a WAL test).
2. The 30-day retention removes older events and keeps newer ones.

---

## F33 — Local model downloads

**Purpose.** Local STT/TTS work out of the box without a huge installer.

**Behaviour.**
- Silero VAD is bundled.
- faster-whisper `small` (int8) and the Kokoro timestamped ONNX export (fp16) + voices file download **on first use** into
  `$XDG_CACHE_HOME/svara/models/`.
- Pinned by revision + SHA-256 (a manifest in the repo); resumable, with retry and progress on the
  avatar and in Advanced; refuses on a hash mismatch.
- Advanced shows disk use per model and offers *Remove* and *Import from file*.
- Models load lazily and unload after 10 idle minutes.

**Out of scope:** choosing arbitrary Hugging Face models from the UI (a different Whisper size is a
config value from a fixed list: `tiny`, `base`, `small`, `medium`); GPU builds; model quantisation
in-app.

**Config & defaults:** `stt.model` = `small`; `models.unloadAfterIdleMin` = 10.

**Depends on:** F10, F12.

**Phase:** 3.

**AC.**
1. The first Talk on a fresh install downloads with visible progress, then works.
2. A tampered file is refused.
3. Offline first use → typing still works, and the voice plugins show `pending: model not
   downloaded`.

---

## F34 — Privacy & data egress

**Purpose.** You always know what leaves your machine.

**Behaviour.**
- The Configure → Privacy table (05 §6) is computed live from the active providers and MCP servers.
- The first screenshot to a cloud model asks for consent once, and the answer is saved.
- No telemetry.
- Logs redact secrets and common key patterns.

**Out of scope:** automatic PII detection or redaction in prompts; per-message egress confirmation;
network firewalling.

**Depends on:** F19, F25, F28.

**Phase:** 4.

**AC.**
1. Switching STT to Deepgram adds "your speech audio → Deepgram" to the table.
2. A fake key in a log line is redacted.

---

## F35 — First-run onboarding

**Purpose.** A new user reaches a working voice conversation without touching a file.

**Behaviour (steps, each skippable):**
1. Welcome, and where things are stored.
2. **Claude**: detect a logged-in Claude Code → use "Claude (your subscription)". Otherwise, show
   how to log in via a terminal, or pick another provider and enter a key, or pick local Ollama.
3. Microphone: pick a source, and a level meter test. Offer echo cancellation (F13).
4. Voice: pick a TTS voice and preview it (triggers the model download, F33).
5. Persona name.
6. Permissions mode (read-only preselected), plus an explanation.
7. Shortcuts: optionally add/rebind Show/Hide, Stop and push-to-talk; explain that Show/Hide and
   push-to-talk also launch Svara when it is not running (F01/F02/F09/F27).
8. Done: the avatar greets you.

**Out of scope:** tutorials or tours beyond these steps; importing settings from other assistants.

**Depends on:** F08, F19, F09, F12, F24, F27.

**Phase:** 6.

**AC.** On a clean Ubuntu 24.04 VM, a tester completes onboarding and has a spoken exchange without
opening a terminal (except the one-time Claude Code login, if they choose the subscription).

---

## F36 — Diagnostics, logs & latency overlay

**Purpose.** When something breaks, the answer is one click away.

**Behaviour.**
- Rotating logs (core + shell), 5 files × 5 MB, in `$XDG_STATE_HOME/svara/logs/`.
- A **diagnostics bundle** (zip): logs, config without secrets, plugin statuses, versions, OS/GPU
  info.
- A **latency overlay** (flag): per-turn stage timings (VAD end → STT → first token → first sentence
  → first audio) and p50/p95 for the last 50 turns.

**Out of scope:** crash reporting to a server; remote log upload; profiling tools in the UI.

**Depends on:** F32.

**Phase:** 1 (logs), 3 (overlay), 6 (bundle).

**AC.** The bundle contains no secret values (a test with seeded fake keys).

---

## F37 — Demo mode (fake providers)

**Purpose.** Run the full app with no keys, no network and no mic, for CI, reviewers and
recruiters.

**Behaviour.** `svara --demo` mounts the `fake` STT/LLM/TTS adapters:
- scripted replies with tags and tool calls;
- TTS that emits a sine-shaped voice-like signal with Tier A timings;
- read-only tools against a bundled sample folder.

A "DEMO" badge shows on the avatar.

**Out of scope:** a guided demo tour; a web-hosted demo of the full app (only `packages/avatar`
may get a static web demo, 09 Phase 7).

**Depends on:** F19, F10, F12.

**Phase:** 1 (text), 3 (voice).

**AC.**
1. CI runs a full scripted turn in demo mode and asserts the message sequence.
2. `--demo` never makes a network request (asserted in the test).

---

## F38 — Packaging & distribution

**Purpose.** A normal Ubuntu install.

**Behaviour.**
- A `.deb` for amd64 (Ubuntu 24.04 and 26.04), built on 24.04, with declared dependencies (09 Phase
  7).
- It installs the app, the `.desktop` file, the icon, `espeak-ng` (dependency), licences and
  `THIRD_PARTY_NOTICES.md`.
- Released on GitHub Releases with SHA-256 checksums.
- Ubuntu Software and `sudo apt remove svara` uninstall the package and leave no Svara process.
- A normal package uninstall deliberately keeps per-user data. Debian maintainer scripts do not
  delete files or dconf keys in users' home directories. For a complete current-user removal, first
  use Configure → Advanced → *Remove my Svara data and integrations* or
  `svara --purge-user-data`; after an explicit confirmation listing the paths, it stops Svara and
  removes its autostart entry, GNOME shortcuts and XDG config/cache/state/data. Then uninstall the
  package (`sudo apt purge svara` also removes package-owned configuration).

**Out of scope:** Snap, Flatpak, PPA/APT repository, auto-update, code signing (post-v1 options),
AppImage as a supported artefact (it may be published as "unsupported").

**Depends on:** all.

**Phase:** 7 (a pre-release `.deb` at v0.5).

**AC.** Install → run → perform the documented complete-removal flow on clean 24.04 and 26.04 VMs:
no running process, user file, autostart entry, Svara-created shortcut or package file remains.
Normal package uninstall is separately tested to retain user data.

---

## F39 — Plugin kernel (developer-facing)

**Purpose.** The mechanism behind live toggles and swaps (01 §2).

**In scope:** `Context`, `Fiber`, `Kernel`; `provide`/`inject` (with optional injects); `effect`
with LIFO disposal; `spawn`; events `emit`, `waterfall`, `serial`; failure isolation; status
reporting.

**Out of scope:** `parallel`/`bail` dispatch; hot module reloading of Python code; loading plugins
from outside the built-in registry; nested isolated contexts.

**Limits:** ≈ 300 lines, with no third-party dependencies beyond the standard library and pydantic.

**Phase:** 1.

**AC.**
1. The property test (random mount/unmount sequences) always returns to the initial registry,
   listener and task state.
2. The dependency reactivity test (01 §2.3) passes.
3. A plugin raising in `apply()` leaves every other plugin active.

---

## F40 — Core ↔ surface protocol (developer-facing)

**Purpose.** The single contract between the core and any surface (01 §4).

**In scope:** the v1 message catalogue and payloads in 13 §7 (overview in 01 §4); the token handshake; topics; `snapshot`; reconnect;
the binary audio framing; the `/assets` route; protocol version integer; pydantic → TS type
generation with a CI drift check.
The management operations and playback acknowledgements in 13 §7.4 are part of this catalogue.
The extension surface and microphone-upload shapes are reserved, rejected in desktop v1.

**Out of scope:** remote (non-loopback) connections; multiple users; any message not in the
catalogue; streaming video.

**Limits:** frame ≤ 1 MB; per-connection rate limit of 200 messages/s (audio frames excluded).

**Phase:** 1.

**AC.**
1. A connection without the token is closed.
2. A reconnect mid-turn receives a `snapshot` with the active state.
3. CI fails when a pydantic model changes without regenerating the TS types.

---

## Definition of done for v1

v1 is done when **every AC for F01–F40 passes**, and in addition:
- the Phase 4 demo script and a spoken 5-minute session run on the dev machine without errors;
- the `.deb` passes F38 on both Ubuntu releases;
- the README (09 Phase 7) is complete;
- nothing outside this document was built.

**The v0.5 portfolio preview** is done when these ACs pass:
- F01–F07, F09–F18, F19 (`claude_subscription` text + tools, `anthropic`, `openai_compat`),
  F20–F24, F25 read tools only, F27, F30–F33, F36 (logs + overlay), F37, F39, F40;
- plus a pre-release `.deb`.

## Changing this specification

Any new feature, limit change or scope expansion is proposed as an edit to this file with a one-line
reason. It is merged before any code for it is written, and 11's traceability table is updated in the
same change.
