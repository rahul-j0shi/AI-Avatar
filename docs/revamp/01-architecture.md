# 01 — Architecture

## 1. The big picture

There are two processes and one protocol between them.

```
┌──────────────────────────── Desktop shell (Tauri 2) ───────────────────────────┐
│  Rust: windows, tray, native context menu, click-through poll, global hotkeys,  │
│        starts/stops the core sidecar, hands the webviews a session token        │
│                                                                                 │
│  Webviews (React + TS):                                                         │
│   • Avatar window   – three.js/VRM renderer, bubble, mic capture, audio playback│
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
# core/src/avatar_core/kernel/ (sketch, not final code)

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
| `pipeline` | plugin, injects `stt? llm tts? performance?` | VAD, turn orchestration, sentence segmenter, barge-in |
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

## 4. Protocol

- **Transport:** one WebSocket per surface window at `ws://127.0.0.1:<port>/ws`. The port is random.
  The shell passes the port and a random bearer token to its webviews at launch. Connections without
  the token are rejected, and the core binds only to loopback.
- **Framing:** text frames carry JSON messages `{ "type": "...", "id"?: "...", ...payload }`. Binary
  frames carry audio with a small header: `stream_id (u32) | seq (u32) | kind (u8) | pcm bytes`.
- **Single source of truth for types:** messages are pydantic models in `core/protocol/messages.py`.
  CI exports their JSON Schema and generates `packages/protocol/src/messages.ts`, and fails on drift.

Message catalogue (v1):

| Direction | Type | Purpose |
|-----------|------|---------|
| surface → core | `hello` | surface kind (`desktop.avatar`, `desktop.panel`, later `extension`), capabilities, protocol version |
| surface → core | `input.text` | Typed message |
| surface → core | `input.audio.begin` / binary PCM / `input.audio.end` | Mic stream (16 kHz mono s16le, 20 ms frames) |
| surface → core | `turn.cancel` | User interrupted |
| surface → core | `permission.reply` | allow_once / allow_always / deny for a request id |
| surface → core | `config.get` / `config.patch` | Settings panel reads and writes |
| surface → core | `conversation.list` / `conversation.get` | Conversations window |
| surface → core | `tools.register` / `tool.result` | *Reserved for the extension:* surface-provided tools |
| core → surface | `state` | Avatar state machine: `idle · listening · thinking · speaking · acting · error` |
| core → surface | `transcript` | Partial and final user transcript |
| core → surface | `assistant.delta` / `assistant.done` | Streaming text for bubble and log |
| core → surface | `performance.segment` | One spoken sentence: audio (binary, same stream id), viseme track, amplitude envelope, expression/gesture cues, text span |
| core → surface | `performance.stop` | Barge-in: flush everything queued |
| core → surface | `tool.activity` | Tool started/finished (shown as small status on the avatar) |
| core → surface | `permission.request` | Needs user approval (rendered as a bubble with buttons) |
| core → surface | `config.changed` / `error` | Housekeeping |

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
  - Plugins' background work uses `ctx.spawn()`, so it is cancelled on unmount.

## 6. Repository layout (target)

```
ai-avatar/
├── core/                         # Python package "avatar_core" (uv project)
│   ├── pyproject.toml
│   ├── src/avatar_core/
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
│   │   ├── src-tauri/            # Rust: windows, menu, click-through, sidecar
│   │   └── src/                  # React: windows/avatar, windows/conversations, windows/configure
│   └── extension/                # README only until the extension phase (see 10)
├── packages/
│   ├── avatar/                   # framework-agnostic TS: VRM loader, performance player, idle behaviours
│   └── protocol/                 # generated TS types for the protocol
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
- **CI:** GitHub Actions matrix (ubuntu, windows, macos) running lint, type checks, unit tests and the
  protocol drift check. Release builds come in Phase 7.
- **ADRs:** one short Markdown file per decision in the table in the README, so reviewers can see the
  reasoning.
