# 01 — Architecture

## 1. The big picture

There are two processes and one protocol between them.

```
┌──────────────────────────── Desktop shell (Tauri 2) ───────────────────────────┐
│  Rust: windows, tray, context menu, input-region click-through, CLI actions     │
│        starts/stops the core sidecar, hands the webviews a session token        │
│                                                                                 │
│  Webviews (React + TS):                                                         │
│   • Avatar window   – three.js/VRM renderer, bubble, audio playback            │
│   • Conversations   – history viewer                                            │
│   • Configure       – settings panel (models, voice, looks, persona, skills,    │
│                       MCP, permissions, features)                               │
└───────────────▲─────────────────────────────────────────────────────────────────┘
                │ WebSocket on 127.0.0.1 (JSON messages + binary audio frames),
                │ per-launch bearer token
┌───────────────┴──────────────── Core (Python 3.14) ────────────────────────────┐
│  Kernel (plugin runtime) ── Config loader (files → plugin tree, hot reload)     │
│                                                                                 │
│  Plugins: providers (llm/stt/tts) · pipeline (vad, turn, segmenter)             │
│           performance (g2p, visemes, expressions) · agent (loop, tools,         │
│           permissions) · desktop tools · mcp servers · skills · persona         │
│           storage (sqlite events, keychain secrets) · protocol server           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why two processes and not one.** The AI stack (local STT/TTS, MCP SDK, desktop automation
libraries, provider SDKs) is strongest in Python. The best floating transparent UI is a webview.
Doing the AI work in Rust or JS would mean re-implementing half the ecosystem. Keeping all the logic
in the core also means a browser extension can reuse it later (see 10).

**Why the core owns logic and the shell owns nothing smart.** The shell and webviews are *surfaces*.
They capture input (mic, text, clicks), render output (avatar, bubble, windows), and execute
surface-specific tools. Every decision is made in the core. That rule is what keeps the browser
extension cheap later.

## 2. Spatiotemporal composability: what we take from DeepSeek's paper

### 2.1 What the paper says

*A Programming Paradigm for Spatiotemporal Composability* (Peking University + DeepSeek-AI, arXiv
2608.25512, Aug 2026) formalises the plugin model of **Cordis**. Cordis is the kernel under Koishi and
under **DeepSeek Harness** ("everything is a plugin": model adapter, tool registry, session log and
even the agent loop are replaceable plugins). It names two independent properties:

- **Temporal composability.** A component can be removed at any time and *all* of its side effects are
  reverted. Every registration (listener, service, tool schema, prompt section, timer, connection) is
  an *effect* with a tracked *inverse*. Effects stack LIFO, and unloading walks the stack back so the
  system returns to the state it had before the component was mounted.
- **Spatial composability.** Components *declare* what they need (coeffects, `inject`) instead of
  importing concrete implementations. The runtime keeps a dependency graph. When a provider appears,
  disappears or changes, only the affected dependents are deactivated and reactivated.

The Cordis primer boils it down to five ideas: a plugin is an object with `apply(ctx)` and optional
`inject`. A context is a repository of services (`ctx.llm`, `ctx.tools`). Dependencies are declared
with `inject`. Communication uses typed events with explicit dispatch modes (`emit`, `waterfall`,
`parallel`, `serial`, `bail`). Registrations are reversible effects (`ctx.effect()`, `ctx.on()`).

### 2.2 Why it fits this project exactly

Your requirements are literally temporal and spatial composability:

| Your requirement | Composability property |
|------------------|------------------------|
| "User can turn any feature on and off" | Temporal: unmount the feature plugin and all of its tools, prompt sections, listeners and background tasks disappear |
| "Adapter pattern, swap LLM/STT/TTS" | Spatial: the pipeline `inject`s `llm`, `stt`, `tts`. Swapping the provider re-activates only the pipeline, not the whole app |
| "Connect MCP servers, load/write skills live" | Each MCP server and each skill is a plugin. Adding or removing one is a mount or unmount with no restart |
| "Browser extension later" | A surface connection is a plugin. Its surface-provided tools (browser tabs, DOM) are effects that vanish when it disconnects |
| "Permissions" | Policy is a `waterfall` listener on `tool.before_call`, which can short-circuit a decision |

### 2.3 How we implement it without over-engineering

We **do not** adopt DeepSeek Harness (it is a Node.js agent harness, a developer preview with
announced breaking changes). We **do not** depend on the community Python port `cordis-py` (single
maintainer, and it documents several deviations from the paper). We write a **mini kernel of about
300 lines** with the same semantics, fully unit-tested. It is also one of the best things in the repo
to show an interviewer.

```python
# core/src/svara_core/kernel/ (sketch, not final code)

class Plugin(Protocol):
    name: str
    inject: tuple[str, ...]            # services required before apply() runs
    async def apply(self, ctx: "Context", config: BaseModel) -> None: ...

class Context:
    """A plugin's view of the kernel. Every registration made through it is an effect
    tied to the plugin's Fiber and reverted LIFO when the fiber unloads."""

    def get(self, key: str) -> Any: ...                     # read an injected service
    def provide(self, key: str, service: Any) -> None: ...  # effect: service appears / disappears
    def on(self, event: str, handler, *, prepend=False) -> None: ...  # effect: listener
    def effect(self, setup: Callable[[], Disposer | Awaitable[Disposer]]) -> None: ...
    def spawn(self, coro) -> None: ...                      # effect: background task, cancelled on unload
    async def emit(self, event, *args) -> None: ...         # observe, fire-and-forget
    async def waterfall(self, event, *args) -> Any: ...     # middleware chain with next()
    async def serial(self, event, *args) -> Any: ...        # in-order, awaited

class Fiber:
    """One mounted plugin instance: config, state (pending | active | failed | disposed), and an
    AsyncExitStack holding its disposers. AsyncExitStack gives LIFO unwinding for free."""

class Kernel:
    async def mount(self, plugin, config) -> Fiber      # waits (pending) until inject is satisfied
    async def unmount(self, fiber) -> None              # dependents first, then LIFO disposers
    async def reconfigure(self, fiber, config) -> None  # unmount + mount, only if config changed
```

Rules we keep, and the paper's guarantees we test:

- **Revertibility test.** For every plugin, mount then unmount leaves the service registry, the
  listener table and the task set identical to the state before the mount. This is a property-based
  test (Hypothesis) that runs random mount/unmount sequences.
- **Dependency reactivity test.** Removing the `llm` provider deactivates `agent` and `pipeline.turn`
  (they go `pending`) and nothing else. Re-providing it re-activates them.
- **Three dispatch modes only** (`emit`, `waterfall`, `serial`). We add `parallel` and `bail` if and
  when something needs them.
- **Unload order** is dependents first, then the plugin's own effects in LIFO order. (`cordis-py` notes
  that the JS runtime unloads a fiber's effects concurrently. We choose the paper's sequential LIFO
  because it is simpler to reason about and we have few effects.)

The **config loader** maps config files to a plugin tree. When a file changes it diffs the tree and
calls `mount`, `unmount` or `reconfigure` only for the entries that changed. That single mechanism
delivers hot reload, feature toggles, provider swapping, MCP add/remove and skill editing.

### 2.4 Where the kernel is *not* used

The frontend does not get a plugin kernel. It is a small UI with a few windows, so plain modules plus
one state store is enough. The browser extension will reuse the core's kernel through the protocol:
surface tools are mounted as plugins *inside the core* (see 10).

## 3. Core modules (Python)

| Module | Kind | Responsibility |
|--------|------|----------------|
| `kernel` | library | Context, Fiber, Kernel, events. No other deps |
| `config` | plugin | Load and validate config files (pydantic), watch files, drive the kernel |
| `protocol` | plugin | WebSocket server, auth token, message (de)serialisation, one fiber per connected surface |
| `storage` | plugin (`ctx.store`) | SQLite event log, conversations |
| `secrets` | plugin (`ctx.secrets`) | OS keychain via `keyring` |
| `providers.llm.*` | plugins (`ctx.llm`) | `ChatModel` adapters (see 05) |
| `providers.stt.*` / `providers.tts.*` | plugins (`ctx.stt`, `ctx.tts`) | Speech adapters (see 04) |
| `audio.input.pipewire` | plugin (`ctx.mic`) | Mic capture from PipeWire (echo-cancelled source when available), pre-roll ring buffer (Ubuntu desktop; see 02 §1.4) |
| `pipeline` | plugin, injects `stt? llm tts? performance? mic?` | VAD, turn orchestration, sentence segmenter, barge-in |
| `performance` | plugin (`ctx.performance`) | G2P, viseme tracks, expressions, gestures (see 03) |
| `agent` | plugin (`ctx.agent`), injects `llm tools` | Tool-calling loop, prompt assembly |
| `tools` | plugin (`ctx.tools`) | Tool registry and permission engine (see 06) |
| `tools.desktop.*` | plugins | fs, clipboard, apps, screen, shell, input |
| `mcp` | one plugin per server | Connect a server and register its tools as effects |
| `skills` | one plugin per skill | Register a skill's metadata in the prompt and expose its body/resources |
| `persona` | plugin | Register the persona prompt section |

`?` means optional inject. With `stt` missing, voice input is off, but typed input still works.

**Prompt assembly** is itself composable. `ctx.prompt.section(id, text, order)` is an effect.
Persona, skills, tool guidance and the performance instructions (expression tags) each contribute a
section. Unmounting a skill removes its section.

**Plugin failure isolation.** If a plugin's `apply()` raises, or its background task crashes, its fiber
goes to `failed`. Its partial effects are reverted and the error (plugin id, message, hint) is published
as `plugin.status`. Every other plugin keeps running. The Features panel lists every plugin with its
state (`active · pending: waiting for <service> · failed: <reason> · disabled`), so "why doesn't voice
work?" always has a visible answer. A failed plugin is retried when its config changes or when the
user clicks *Retry*. There is no automatic retry loop.

**Which plugins exist.** v1 plugins are **built-in only**, listed in one static registry
(`svara_core/plugins.py`). There is no loading of third-party Python code: user extensibility in v1 is
MCP servers, skills and persona, which are data or out-of-process. A Python entry-point mechanism for
third-party plugins is a post-v1 item, because loading arbitrary Python into the core would bypass
the permission model.

## 3a. Process lifecycle (shell ↔ core)

| Concern | Decision |
|---------|----------|
| Environment | The shell starts the avatar window through XWayland (`GDK_BACKEND=x11`, 02 §1.2) and applies the WebKitGTK/NVIDIA workaround env (`WEBKIT_DISABLE_DMABUF_RENDERER=1`) only when an NVIDIA proprietary driver is detected |
| CLI actions | `svara --action talk \| stop \| show \| hide \| toggle \| mute-mic \| pause-voice \| configure \| quit` and `svara --volume 0..100`. `talk`, `show`, `toggle` and `configure` cold-start the app when needed; otherwise actions forward to the running instance. `stop`, `hide` and `quit` are harmless no-ops when it is not running. GNOME custom shortcuts call this contract (02 §1.2, §3.1) |
| Start | The shell generates a random 256-bit token and spawns the core sidecar with it in an env var (`SVARA_TOKEN`). The core binds `127.0.0.1:0` and prints one JSON line `{"port": N, "pid": P, "protocol": 1}` on stdout. The shell reads it and gives port + token to its webviews through a Tauri command (`get_core_endpoint`), never in a URL |
| Readiness | The shell shows the avatar in a `booting` state until the core answers `hello`. Core startup target: under 1.5 s to `hello`. Heavy models load lazily (below) |
| Orphans | The core exits when its stdin closes (the shell holds the pipe), so a crashed shell never leaves a zombie core |
| Crash | If the core exits unexpectedly, the shell restarts it with backoff (1 s, 2 s, 5 s, then stop and show "Core stopped: View logs / Restart") |
| Single instance | `tauri-plugin-single-instance`: launching the app again focuses the existing avatar |
| Launch at login | `tauri-plugin-autostart`, off by default, toggle in Features |
| Exit | Menu → Exit: the shell sends `shutdown`. The core cancels the current turn, flushes the event log, stops MCP servers (SIGTERM, then kill after 3 s) and exits. The shell waits up to 5 s, then kills it |
| Sleep/wake | On resume from sleep, surfaces reconnect (below) and MCP HTTP servers are re-checked |

**Resource budget (always-on app).** Idle target: < 250 MB RAM for the core with no local models
loaded, and < 3% CPU. Local models (Whisper, Kokoro, Silero) load **on first use** and unload after 10
idle minutes (configurable). The first-use cost is hidden by preloading when the user double-clicks,
since listening takes at least a second anyway. Memory while all local models are loaded is measured
in Phase 3 and published.

## 4. Protocol

- **Transport:** one WebSocket per surface window at `ws://127.0.0.1:<port>/ws`. The port is random
  (see 3a). The token must be the first message on every connection, and connections without it are
  rejected. The core binds only to loopback.
- **Framing:** text frames carry JSON messages `{ "type": "...", "id"?: "...", ...payload }`. Binary
  frames carry audio with a small header: `stream_id (u32) | seq (u32) | kind (u8) | pcm bytes`.
- **Single source of truth for types:** messages are pydantic models in `core/protocol/messages.py`.
  CI exports their JSON Schema and generates `packages/protocol/src/messages.ts`, and fails on drift.

Message catalogue (v1). **The authoritative field-level payload reference is 13 §7**; this table is
the overview:

| Direction | Type | Purpose |
|-----------|------|---------|
| surface → core | `hello` | surface kind (`desktop.avatar`, `desktop.panel`, later `extension`), capabilities, protocol version |
| surface → core | `input.text` | Typed message |
| surface → core | `listen.start` / `listen.stop` | Double-click / push-to-talk: start or stop listening. On the desktop the core captures the mic itself |
| surface → core | `input.audio.begin` / binary PCM / `input.audio.end` | *Reserved for surfaces that capture the mic themselves (the browser extension):* 16 kHz mono s16le, 20 ms frames |
| surface → core | `turn.cancel` | User interrupted |
| surface → core | `permission.reply` | allow_once / allow_always / deny for a request id |
| surface → core | `config.get` / `config.patch` | Settings panel reads and writes |
| surface → core | `conversation.list` / `conversation.get` | Conversations window |
| surface → core | `tools.register` / `tool.result` | Surface-provided tools. Used in v1 by the avatar surface for the clipboard (06 §4), and later by the browser extension |
| core → surface | `tool.call` | Ask the surface to run one of its registered tools |
| core → surface | `state` | Assistant state (see the state machine below) |
| core → surface | `transcript` | Partial and final user transcript |
| core → surface | `assistant.delta` / `assistant.done` | Streaming text for bubble and log |
| core → surface | `performance.segment` | One spoken sentence: audio (binary, same stream id), viseme track, amplitude envelope, expression/gesture cues, text span |
| core → surface | `performance.stop` | Barge-in: flush everything queued |
| core → surface | `tool.activity` | Tool started/finished (shown as small status on the avatar) |
| core → surface | `permission.request` | Needs user approval (rendered as a bubble with buttons) |
| core → surface | `config.changed` / `error` | Housekeeping |
| surface → core | `secrets.set` / `secrets.delete` | **Write-only** secret storage. `config.get` never returns secret values, only `{set: true, last4}` |
| surface → core | `conversation.new` | Start a new conversation (menu item) |
| surface → core | `shutdown` | Graceful exit (shell only) |
| core → surface | `snapshot` | Sent right after `hello`: current state, active turn (if any), pending permission requests, config version, plugin statuses |
| core → surface | `plugin.status` | A plugin became active / pending / failed / disabled |
| core → surface | `model.download` | Progress of first-use model downloads (see 08 §6) |

**Routing.** Each connection says in `hello` which *topics* it wants. The avatar window subscribes to
`turn` (state, transcript, deltas, performance, tool activity, permission requests). Conversations
subscribes to `conversation`. Configure subscribes to `config` and `plugin`. Only the avatar surface
receives `performance.*` and audio. Mic audio comes from the core's own `mic` plugin on the desktop. If two surfaces
claim the avatar role (later: desktop + extension overlay), the most recently *focused* one gets
performance output, and the other shows the text only.

**Reconnect.** The WS client reconnects with backoff. On reconnect it gets a fresh `snapshot`. If the
avatar surface was disconnected mid-turn, the core cancels the running performance (audio can't be
resumed) but keeps the text and tool results, so nothing is lost from the conversation.

**Hardening.** Bind to loopback only. Require the token as the first message (not a query string, so
it never lands in logs). Check the `Origin` header (allow only the Tauri origins, later the extension
host). Limit frame size to 1 MB and apply a per-connection message rate limit. The config dir is created
with user-only permissions (0700 on POSIX).

**Asset serving.** The core also serves `GET /assets/<path>` (token in the `Authorization` header,
read-only, rooted at the config dir's `avatar/` folder) so any surface, desktop or future extension,
loads `.vrm`/`.vrma` files the same way.

**Protocol versioning.** `hello.protocol` is an integer. The core accepts the current and previous
version. Anything else gets a clear `error` ("update the extension/app").

**Avatar/assistant state machine** (owned by the core; surfaces only render it):

States: `booting · idle · listening · thinking · speaking · acting · awaiting_approval · error`.

| From | Event | To |
|------|-------|----|
| booting | core answers `hello` | idle |
| idle | double-click / push-to-talk | listening |
| idle | typed input | thinking |
| listening | VAD end-of-speech with a non-empty transcript | thinking |
| listening | cancel, or no speech for 8 s, or empty/noise transcript | idle |
| thinking | first sentence ready (voice on) | speaking |
| thinking | text done (bubble-only mode) | idle |
| thinking / speaking | model requests a tool | acting |
| acting | the permission engine says ASK | awaiting_approval |
| awaiting_approval | Allow / Deny / timeout | acting (allowed) or thinking (denied; the model is told) |
| acting | tool finished | thinking |
| speaking | last segment played and the model is done | idle |
| speaking | barge-in (user speech > 250 ms) | listening |
| any | Stop (menu / hotkey) | idle |
| any | unrecoverable error in the turn | error → idle after the message is shown |


- **New input while busy:** any new user input (typed or spoken) while `thinking`, `speaking` or
  `acting` cancels the current turn and starts a new one. This is the same mechanism as barge-in, so
  there is no queueing of user messages.
- **While `awaiting_approval`:** the approval bubble must be answered or it times out. Other typed
  input is held until then (the type box shows "Answer the permission request first"). Approvals are
  **buttons only**, never voice, so ambient speech can't approve an action.
- **Bubble in speak-only mode:** permission requests and errors always show a bubble, whatever the
  response mode.

## 5. Concurrency model (and the Python 3.14 question)

**Short answer:** yes, move to the newest Python, but not mainly for multithreading. This workload is
I/O-bound (network calls to providers, waiting on audio). `asyncio` handles that better than threads
in any Python version.

- Python 3.14 (Oct 2025) made the **free-threaded build officially supported** (PEP 779), but it is
  **not the default build**. It ships as a separate interpreter (`python3.14t`). Any C extension that
  hasn't opted in silently re-enables the GIL. The heavy parts of this app (onnxruntime,
  CTranslate2/faster-whisper, torch) are native code that already releases the GIL while it computes,
  so free-threading gains us little today.
- **Decision:** standard CPython 3.14 via `uv`. In Phase 0 we check that every native dependency has
  cp314 wheels. If one doesn't, we pin 3.13 and note it in an ADR. Python 3.15 is due in Oct 2026, and
  we upgrade when our dependencies do. Free-threaded `3.14t` is an optional CI job (a "nice to have"
  experiment for the README, not a dependency).
- **Structure:**
  - One event loop. Each conversational *turn* is an `asyncio.TaskGroup` with stages connected by
    **bounded `asyncio.Queue`s** (backpressure: TTS can't run 30 sentences ahead of playback).
  - **Barge-in is cancellation.** Cancelling the turn's TaskGroup cancels STT, LLM stream, TTS and
    pending tool calls together, because structured concurrency guarantees nothing leaks.
  - CPU-bound inference (Whisper, Kokoro, Silero, G2P) runs in a dedicated `ThreadPoolExecutor`
    through `loop.run_in_executor`, with at most one job per model so they don't thrash.
    **Caveat:** cancelling a turn cannot stop a thread that is already running inference. The job
    finishes and its result is discarded. We keep jobs short (one sentence or one utterance) so a
    cancelled job wastes at most a few hundred ms.
  - Plugins' background work uses `ctx.spawn()`, so it is cancelled on unmount.

## 6. Repository layout (target)

```
svara/
├── core/                         # Python package "svara_core" (uv project)
│   ├── pyproject.toml
│   ├── src/svara_core/
│   │   ├── kernel/               # context.py fiber.py events.py
│   │   ├── config/               # models.py (pydantic), loader.py, watcher.py
│   │   ├── protocol/             # messages.py, server.py
│   │   ├── storage/              # events.py (sqlite), secrets.py
│   │   ├── providers/{llm,stt,tts}/   # base.py + one file per adapter
│   │   ├── pipeline/             # vad.py, turn.py, segmenter.py
│   │   ├── performance/          # g2p.py, visemes.py, expressions.py, data/phoneme_viseme.json
│   │   ├── agent/                # loop.py, prompt.py
│   │   ├── tools/                # registry.py, permissions.py, desktop/*.py
│   │   ├── mcp/  skills/  persona/
│   │   └── __main__.py           # composition root
│   └── tests/
├── apps/
│   ├── desktop/                  # Tauri 2 app
│   │   ├── src-tauri/            # Rust: windows, menu, input-region click-through, sidecar
│   │   │                         #   (or electron/ if Spike A picks Electron, see 02 §1.3)
│   │   └── src/                  # React: windows/avatar, windows/conversations, windows/configure
│   └── extension/                # README only until the extension phase (see 10)
├── packages/
│   ├── avatar/                   # @svara/avatar: framework-agnostic VRM renderer
│   └── protocol/                 # @svara/protocol: generated protocol types
├── docs/                         # this plan, ADRs (docs/adr/NNNN-title.md), architecture diagrams
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

`packages/avatar` has no React and no Tauri imports, so the extension (or a web demo page for the
portfolio) can render the same avatar. That is the one place where early separation pays for itself.

## 7. Tooling

- **Python:** `uv`, `ruff` (lint + format), `pyright` (strict for `kernel`, `protocol`, `tools`),
  `pytest` + `pytest-asyncio` + `hypothesis`.
- **TypeScript:** `pnpm`, Vite, `biome` (lint + format), `vitest`, `tsc --noEmit`.
- **Rust:** `cargo fmt`, `clippy`. Keep the Rust side small.
- **CI:** GitHub Actions on `ubuntu-24.04` (plus the test suite in an `ubuntu:26.04` container)
  running lint, type checks, unit tests and the protocol drift check. Release builds (`.deb`) are
  built on 24.04 so the bundled core links against the older glibc and runs on both releases.
- **ADRs:** one short Markdown file per decision in the table in the README, so reviewers can see the
  reasoning.
