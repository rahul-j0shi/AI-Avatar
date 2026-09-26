# 13 — Implementation guide & backlog

This is where building starts. **12 defines what**, and this document defines **in what order, with
what tools, and by which conventions**. Work through the backlog (§8) top to bottom. Every task names
the features and acceptance criteria (AC) from 12 that it must satisfy.

---

## 1. How work flows

1. Pick the next task in §8 whose dependencies are done.
2. **Definition of Ready:** the task's features exist in 12 with ACs, open design points are
   covered in 01–08 or an ADR, and the dependencies are merged.
3. Branch `feat/<task-id>-<slug>` (e.g. `feat/T1.1-kernel`), with one PR per task (split a task
   only if a PR would exceed ~600 changed lines of non-generated code).
4. **Definition of Done:**
   - the task's ACs pass as automated tests (or a written manual check where 12 says manual);
   - CI is green;
   - the docs are updated if behaviour changed (12 first);
   - nothing outside the task's scope is added.
5. If a spike or task shows the plan is wrong: write or update an ADR, change 12 if scope changes,
   then continue.

---

## 2. Verified toolchain & dependency baseline (checked on PyPI/npm, Sep 2026)

Versions are the current releases at planning time. Phase 0 locks exact versions in `uv.lock`,
`pnpm-lock.yaml` and `Cargo.lock`, and upgrades are deliberate PRs.

### 2.1 Toolchain

| Tool | Version line | Notes |
|------|-------------|-------|
| Python | **3.14** (uv-managed, standard GIL build) | Every chosen package below has Linux x86-64 wheels for 3.14 |
| uv | 0.12.x | Environments, lockfile, Python install |
| Node.js | **24 LTS** | For the frontend build only; not shipped (except inside Electron if Spike A picks it) |
| pnpm | 12.x | Workspace |
| Rust | stable | Tauri path only |
| Tauri CLI / crates | 2.11.x | With `tauri-plugin-single-instance` and `tauri-plugin-autostart` |
| Electron | 44.x | Only if Spike A picks it |
| ruff 0.16.x · pyright 1.1.41x · pytest + pytest-asyncio + hypothesis 6.x | — | Python quality |
| biome 2.5.x · vitest 5.x · TypeScript 5.x | — | TS quality |

### 2.2 Python runtime dependencies (the complete list for v1)

| Package | Version line | Used for | Verified |
|---------|-------------|----------|----------|
| `pydantic` (v2) | 2.x | Config and protocol models, JSON Schema | cp314 wheels ✓ |
| `starlette` + `uvicorn` | 1.7.x / 0.54.x | WebSocket + `/assets` HTTP on loopback | ✓ |
| `watchfiles` | 1.3.x | Config watcher | ✓ |
| `keyring` | 25.x | Secret Service | ✓ |
| `dbus-fast` | 5.x | Portals (Screenshot, RemoteDesktop), AT-SPI, notifications | ✓ |
| `onnxruntime` | 1.30.x | Kokoro, Silero VAD | cp314 ✓ |
| `faster-whisper` → `ctranslate2`, `av`, `tokenizers` | 1.2.x → 4.8.x, 18.x, 0.23.x | Local STT | cp314 ✓ |
| `numpy` | 2.5.x | Audio math | ✓ |
| `anthropic` | 1.8.x | `anthropic` adapter | ✓ |
| `openai` | 3.x | `openai_compat` adapter | ✓ |
| `google-genai` | 2.x | `gemini` adapter (Phase 5) | ✓ |
| `claude-agent-sdk` | 0.2.x | `claude_subscription` adapter (with `cli_path` → the user's `claude`) | ✓ |
| `mcp` | 2.x | MCP client | ✓ |
| `httpx` | 0.28.x | Cloud STT/TTS adapters, model downloads | ✓ |
| `pypdf` | latest | `fs.read_file` PDF text | pure Python |

**Rejected, on purpose** (do not add them): `kokoro-onnx` (Python < 3.14, in-process GPL through
`phonemizer`/`espeakng-loader`), `kokoro` (PyTorch), `misaki` (Python < 3.13, GPL deps, spaCy),
`silero-vad` (PyTorch), `phonemizer`/`phonemizer-fork`, `PyGObject` (no wheels, hard to bundle),
`sounddevice` (can't target PipeWire nodes; allowed only as a documented fallback if Spike D requires
it), `mss`/`pynput`/`pyautogui` (don't work on Wayland), `langgraph`, `torch`.

**System packages** (`.deb` Depends): `espeak-ng`, `pipewire-bin` (for `pw-record`), `xdg-utils`,
`libglib2.0-bin` (for `gio`), `libayatana-appindicator3-1`, plus `libwebkit2gtk-4.1-0` and
`gstreamer1.0-plugins-base|good` on the Tauri path.

### 2.3 Frontend dependencies (the complete list for v1)

| Package | Version line | Used for |
|---------|-------------|----------|
| `react`, `react-dom` | 19.x | Windows UI |
| `vite` | 8.x | Build |
| `three` | 0.186.x | Rendering |
| `@pixiv/three-vrm`, `@pixiv/three-vrm-animation` | 3.5.x | VRM + VRMA (peer: three ≥ 0.137 ✓) |
| `zustand` | 5.x | One store |
| `monaco-editor` | 0.57.x | Config editors with JSON Schema |
| `jsonc-parser` | 3.3.x | Comment-preserving edits |
| `json-schema-to-typescript` (dev) | 16.x | Protocol type generation |
| `@tauri-apps/api` + plugins | 2.x | Tauri path only |

**Rejected:** UI kits, Redux, react-three-fiber (the renderer stays framework-agnostic in
`packages/avatar`), CSS frameworks (use plain CSS modules).

---

## 3. Repository bootstrap (what T0.1–T0.4 produce)

```
svara/
├── core/
│   ├── pyproject.toml            # name "svara-core", requires-python ">=3.14,<3.15"
│   ├── src/svara_core/…         # layout from 01 §6
│   └── tests/{unit,contract,integration,golden}/
├── apps/desktop/
│   ├── package.json              # the web UI
│   ├── src/                      # React (02 §7)
│   └── src-tauri/ | electron/    # decided by T0.7
├── apps/extension/README.md      # the "next" pointer (10)
├── packages/avatar/              # @svara/avatar; no React/Tauri imports (lint-enforced)
├── packages/protocol/            # @svara/protocol; generated types (committed; drift-checked)
├── assets/                       # default VRM, VRMA, LICENSES.md (Git LFS: *.vrm *.vrma)
├── docs/revamp/ · docs/adr/
├── pnpm-workspace.yaml · .gitattributes · .editorconfig
└── .github/workflows/ci.yml
```

**Root commands** (as a `justfile` or `Makefile`; pick one in T0.3 and keep only that):

| Command | Does |
|---------|------|
| `setup` | `uv sync` in `core/`, `pnpm install` |
| `lint` | ruff check + ruff format --check + pyright + biome check + (cargo fmt --check, clippy) |
| `test` | pytest (unit, contract, golden) + vitest |
| `gen` | Export protocol/config JSON Schemas and regenerate `packages/protocol` |
| `dev` | Run the core and the desktop app in dev mode |
| `demo` | Run the app with `--demo` (F37) |

**CI (T0.3):** a job on `ubuntu-24.04` (lint, test, and `gen` + `git diff --exit-code`), plus a job
running the core test suite in an `ubuntu:26.04` container. No GPU and no GUI tests in CI.

---

## 4. Engineering conventions

**Python**
- Type hints everywhere. `pyright` strict for `kernel`, `protocol`, `tools`, `config`; basic mode
  elsewhere.
- **No blocking calls on the event loop:** network I/O is async; CPU work and blocking subprocess
  reads go through the executor or `asyncio.create_subprocess_exec`. A test helper asserts loop lag
  < 50 ms during the pipeline tests.
- Pydantic v2 models for every config file and protocol message, with `extra="forbid"` for protocol
  messages and `extra="allow"` + a warning for config (08 §4a).
- Errors: typed exceptions per boundary (`ProviderAuthError`, …, 04 §4a); never bare
  `except Exception` without re-raise or logging with context.
- Logging: stdlib `logging` with a JSON formatter; the redaction filter always installed (F34).
- Every plugin lives in one module with a `plugin = Plugin(name=…, inject=…, apply=…)`, registered in
  `svara_core/plugins.py`.

**TypeScript**
- `strict: true`; no `any` except at the WS boundary, where it is validated against the generated
  types.
- `packages/avatar` is pure TS + three; the lint rule forbids imports of `react` and `@tauri-apps/*`
  there.

**Tests**
- `unit/` is fast and pure.
- `contract/` holds adapter suites with recorded HTTP cassettes; no network in CI.
- `integration/` runs the core against fake providers and a fake surface.
- `golden/` holds viseme tracks.
- Every AC in 12 maps to at least one test id, noted as `# AC F24.1` in the test.

**Commits & PRs**
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- The PR description lists the task id and the ACs covered.
- Squash-merge into `main`, and `main` is always green.

---

## 5. ADR index

Stored in `docs/adr/NNNN-title.md` using the template below. The accepted decisions are written in
T0.4, and the rest by the spikes.

| ADR | Decision | Status at start |
|-----|----------|-----------------|
| 0001 | Record decisions as ADRs | Accepted |
| 0002 | Ubuntu 24.04/26.04 only; the avatar window runs through XWayland (02 §1) | Accepted |
| 0003 | Two processes: Python core + web shell; the core owns all logic (01 §1) | Accepted |
| 0004 | In-house plugin kernel with Cordis semantics (01 §2) | Accepted |
| 0005 | Python 3.14 standard build, asyncio, executor for inference (01 §5) | Accepted |
| 0006 | Shell: Tauri 2 vs Electron | **Proposed → decided by Spike A (T0.7)** |
| 0007 | VRM 1.0 + three.js/three-vrm; CC0 VRoid preset default (03 §1) | Accepted |
| 0008 | Performance engine: IPA → 15 visemes, timing tiers, keyframes + envelope (03) | Accepted |
| 0009 | Kokoro own runner on the timestamped ONNX; espeak-ng subprocess; no in-process GPL (03 §4.7–4.8) | Accepted (Spike B confirms timing) |
| 0010 | Mic in the core via `pw-record`; PipeWire echo-cancel in monitor mode (02 §1.4) | Accepted (Spike D confirms monitor mode on PipeWire 1.0) |
| 0011 | LLM ports `ChatModel` + `AgentBackend`; Claude subscription first via the Agent SDK (05) | Accepted (Spike E gate) |
| 0012 | Own agent loop; append-only history (06 §1, 05 §2a) | Accepted |
| 0013 | Permission model: capability rules, read-only default, handler-level enforcement (06) | Accepted |
| 0014 | JSONC config + pydantic schemas + live reload via plugin-tree diff (08) | Accepted |
| 0015 | SQLite append-only event log (08 §4) | Accepted |
| 0016 | `.deb` only, no Snap/Flatpak/auto-update (12 F38) | Accepted |

**Template**

```markdown
# NNNN — Title
Status: Proposed | Accepted | Superseded by NNNN
Context: what forces the decision (2–5 sentences, link plan sections)
Decision: what we do (bullets)
Consequences: what gets easier / harder; what we will not do
Evidence: spike results, links (if any)
```

---
## 6. Config key reference (every v1 key)

All keys are validated by pydantic, and the JSON Schema is generated for Monaco. "Range" violations
are validation errors. The source feature is in 12.

### 6.1 `config.json`

| Key | Type | Default | Range / values | Feature |
|-----|------|---------|----------------|---------|
| `version` | int | 1 | — | F30 |
| `features.*` | bool | see 12 §0.4 | — | F30 |
| `ui.responseMode` | enum | `speak+bubble` | `speak+bubble`, `bubble`, `speak` | F11 |
| `ui.bubbleHideAfterSec` | int | 8 | 3–60 | F05 |
| `ui.outputVolume` | float | 1.0 | 0.0–1.0 | F03, F11, F12 |
| `ui.avatar.scale` | float | 1.0 | 0.5–2.0, step 0.1 | F02 |
| `ui.avatar.position` | object \| null | null | `{monitor, x, y}` (machine-written) | F02 |
| `ui.micMuted` / `ui.voicePaused` | bool | false | — | F03 |
| `audio.input.source` | string | `auto` | a PipeWire node name or `auto` | F09 |
| `stt.provider` | enum | `faster_whisper` | `faster_whisper`, `deepgram`, `google_stt`, `openai_stt` | F10 |
| `stt.model` | string | `small` | faster-whisper: `tiny`, `base`, `small`, `medium`; others: provider model id | F10, F33 |
| `stt.language` | string | `auto` | `auto` or an ISO 639-1 code | F10 |
| `stt.vad.threshold` | float | 0.5 | 0.3–0.8 | F09 |
| `stt.vad.endSilenceMs` | int | 700 | 300–2000 | F09 |
| `stt.noSpeechTimeoutSec` | int | 8 | 3–30 | F09 |
| `bargeIn.minSpeechMs` | int | 250 | 150–1000 | F13 |
| `tts.provider` | enum | `kokoro` | `kokoro`, `elevenlabs`, `azure_tts`, `openai_tts`, `coqui` | F12 |
| `tts.voice` | string \| null | null (provider default) | provider voice id | F12 |
| `tts.speed` | float | 1.0 | 0.7–1.3 | F12 |
| `tts.defaultLanguage` | string | `en` | ISO 639-1 | F12, F15 |
| `tts.voicesByLanguage` | map | {} | lang → voice id | F12 |
| `llm.provider` | string \| null | `claude_subscription` if detected, else null | a key of `providers` | F19 |
| `llm.model` | string \| null | null (provider default) | — | F19 |
| `llm.effort` | enum | `low` | `low`…`max` (the `anthropic` adapter only) | F19 |
| `llm.visionModel` | object \| null | null | `{provider, model}` | F19 |
| `llm.fallback` | object \| null | null | `{provider, model}` | F19 |
| `providers.<id>.adapter` | enum | — | `claude_subscription`, `anthropic`, `openai_compat`, `gemini` | F19 |
| `providers.<id>.baseUrl` | url | adapter preset | — | F19 |
| `providers.<id>.apiKey` | `{secret: name}` \| null | null | — | F31 |
| `providers.<id>.enabled` | bool | true | — | F30 |
| `providers.<id>.capabilities` | object | detected | `{tools, vision, maxContext}` (file-only override) | F19 |
| `agent.maxSteps` | int | 8 | 1–25 | F20 |
| `agent.turnTimeoutSec` | int | 120 | 30–600 | F20 |
| `agent.maxOutputTokens` | int | 1024 | 256–8192 | F19 |
| `agent.newConversationAfterMin` | int | 30 | 5–1440 | F21 |
| `desktopTools.<group>.enabled` | bool | true (`shell`: false) | groups: `fs`, `clipboard`, `screen`, `apps`, `system`, `shell` | F25 |
| `models.unloadAfterIdleMin` | int | 10 | 1–120 | F33 |
| `storage.retentionDays` | int \| null | null (forever) | null, 30, 90 | F32 |
| `privacy.screenshotConsent` | bool \| null | null (ask) | machine-written | F34 |
| `skills.<name>.enabled` | bool | true (in-app), false (imported) | — | F29 |

### 6.2 Other files

| File | Keys | Feature |
|------|------|---------|
| `permissions.json` | `version`, `mode` (`read-only` \| `ask` \| `trusted`, default `read-only`), `rules.deny[]`, `rules.ask[]`, `rules.allow[]`, `approvalTimeoutSec` (60, 15–300) | F24 |
| `permissions.local.json` | `allow[]` exact-resource rules (machine-written) | F24 |
| `mcp.json` | `mcpServers.<name>`: `command`, `args[]`, `env{}` \| `type: "http"`, `url`, `headers{}`; plus `enabled` (true), `timeoutSec` (60), `connectTimeoutSec` (20) | F28 |
| `persona.md` | frontmatter `name`, `voice`, `speed`; body ≤ 32 KB | F22 |
| `skills/<name>/SKILL.md` | frontmatter `name` (≤ 64, `[a-z0-9-]`), `description` (≤ 1,024), `enabled` (in `config.json` `skills.<name>.enabled`, default true for skills created in-app and false for imported ones) | F29 |
| `avatar/avatar.json` | 12 F14 field list | F14 |

---

## 7. Protocol payload reference (v1, protocol = 1)

JSON text frames: `{"type": "<type>", "id"?: "<request id>", ...fields}`. A request that expects a
reply carries `id`, and the reply echoes it. Every field is required unless marked `?`.

### 7.1 Surface → core

| Type | Fields | Reply |
|------|--------|-------|
| `hello` | `protocol: 1`, `token`, `surface: "desktop.avatar"\|"desktop.conversations"\|"desktop.configure"\|"extension"`, `topics: ("turn"\|"conversation"\|"config"\|"plugin")[]`, `capabilities: {audioOut: bool, micCapture: bool}` | `snapshot` or `error` + close |
| `input.text` | `text` (1–4,000 chars) | — |
| `listen.start` / `listen.stop` | — | — |
| `input.audio.begin` / `input.audio.end` | `streamId: u32`, (`begin` only) `sampleRate: 16000`, `format: "s16le"` | — |
| `turn.cancel` | — | — |
| `permission.reply` | `requestId`, `decision: "allow_once"\|"allow_always"\|"deny"` | — |
| `config.get` | `file: "config"\|"permissions"\|"permissions.local"\|"mcp"\|"persona"\|"avatar"\|"skill:<name>"` | `config.value {file, text, version}` |
| `config.patch` | `file`, `text`, `baseVersion` | `config.result {file, ok, version?, errors?: {line, col, message}[]}` |
| `secrets.set` | `name`, `value` | `secrets.result {name, ok, last4?}` |
| `secrets.delete` | `name` | `secrets.result {name, ok}` |
| `conversation.list` | `cursor?`, `limit` (≤ 100), `query?` | `conversation.page {items: {id, title, createdAt, updatedAt}[], nextCursor?}` |
| `conversation.get` | `conversationId`, `cursor?`, `limit` (≤ 200) | `conversation.events {conversationId, events: Event[], nextCursor?}` |
| `conversation.new` | — | — |
| `conversation.delete` | `conversationId` | `ok` |
| `conversation.export` | `conversationId` | `conversation.markdown {conversationId, markdown}` |
| `tools.register` | `tools: {name, description, inputSchema, capability, effect}[]` | `ok` |
| `tool.result` | `callId`, `ok`, `content` (string ≤ 1 MB), `error?` | — |
| `plugin.retry` | `pluginId` | — |
| `shutdown` | — (shell only) | — |

### 7.2 Core → surface

| Type | Fields | Topic |
|------|--------|-------|
| `snapshot` | `state`, `conversationId`, `turn?: {id, startedAt}`, `pendingPermissions: PermissionRequest[]`, `configVersions: {file: version}`, `plugins: PluginStatus[]`, `demo: bool` | (all) |
| `state` | `state: "booting"\|"idle"\|"listening"\|"thinking"\|"speaking"\|"acting"\|"awaiting_approval"\|"error"`, `turnId?`, `detail?` | turn |
| `transcript` | `turnId`, `text`, `final: bool` | turn |
| `assistant.delta` | `turnId`, `text` (already cleaned of tags) | turn |
| `assistant.done` | `turnId`, `stopReason: "end"\|"max_steps"\|"cancelled"\|"refusal"\|"error"\|"timeout"`, `usage?: {inputTokens, outputTokens}` | turn |
| `performance.segment` | `turnId`, `segmentId`, `streamId`, `sampleRate`, `durationMs`, `text`, `visemes: [tMs, viseme, weight][]`, `envelope` (base64 u8 @100 Hz), `cues: {tMs, kind, name, intensity, durationMs?}[]`, `wordSpans: [tMs, charStart, charEnd][]` | turn (avatar only) |
| `performance.stop` | `turnId` | turn (avatar only) |
| `tool.activity` | `turnId`, `callId`, `name`, `phase: "start"\|"end"`, `ok?`, `summary` (≤ 80 chars) | turn |
| `tool.call` | `callId`, `name`, `args` | (the registering surface) |
| `permission.request` | `requestId`, `turnId`, `tool`, `capability`, `resource`, `description`, `timeoutSec` | turn |
| `plugin.status` | `pluginId`, `state: "active"\|"pending"\|"failed"\|"disabled"`, `reason?` | plugin |
| `model.download` | `model`, `receivedBytes`, `totalBytes`, `done`, `error?` | plugin |
| `config.changed` | `file`, `version` | config |
| `conversation.updated` | `conversationId` | conversation |
| `error` | `code`, `message`, `requestId?` | (sender) |

### 7.3 Binary frames

Little-endian header, then payload:

| Offset | Size | Field |
|--------|------|-------|
| 0 | u32 | `streamId` |
| 4 | u32 | `seq` (from 0, per stream) |
| 8 | u8 | `kind`: 1 = mic PCM (surface → core), 2 = TTS PCM (core → surface), 3 = end of stream |
| 9 | … | PCM s16le mono (≤ 32 KB per frame) |

A TTS segment's frames (kind 2, then kind 3) are all sent **before** its `performance.segment`
(03 §3). The renderer schedules the segment when both are present.

---
## 8. Ordered backlog

Columns: **Task** · **Implements** (12 features / ACs, or plan section) · **Depends on** · **Done
when**. Tasks inside a phase are in the recommended order. Tasks without mutual dependencies can run
in parallel.

### Phase 0 — Reset, foundations, spikes

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T0.1 | Tag `v0-prototype`; delete the legacy files (09 Phase 0 list) | 09 | — | `main` holds only `docs/`, LICENSE, README stub |
| T0.2 | Create the repo skeleton (§3), Git LFS for `*.vrm *.vrma` | §3 | T0.1 | The tree exists; `setup` runs on 24.04 |
| T0.3 | Lint/test tooling, root commands, CI (§3) | §3, §4 | T0.2 | CI green on an empty test in both jobs |
| T0.4 | Write ADR-0001–0016 (0006 as Proposed) | §5 | T0.2 | 16 files in `docs/adr/` |
| T0.5 | Spike A-Tauri: transparent XWayland window + VRM + drag + input region + WebAudio | 02 §1.2–1.3 | T0.2 | Measurements recorded against the 02 §1.3 criteria |
| T0.6 | Spike A-Electron: the same page, same checks | 02 §1.3 | T0.2 | Measurements recorded |
| T0.7 | Decide the shell; ADR-0006 Accepted; delete the losing spike | 02 §1.3 | T0.5, T0.6 | ADR merged |
| T0.8 | Spike B: minimal Kokoro runner (timestamped ONNX, espeak-ng IPA → tokens → `pred_dur`) + hand-built viseme track on the VRM | 03 §4.8 | T0.5 or T0.6 | Timing error vs envelope noted; ADR-0009 evidence |
| T0.9 | Spike C: locked deps install + smoke calls on 3.14 | §2 | T0.3 | All imports and smoke calls pass on 24.04 and in the 26.04 container |
| T0.10 | Spike D: Ubuntu integration checks (02 §1.2 "to verify" + PipeWire echo-cancel monitor mode + focus hint) | 02 §1.2, §1.4 | T0.5 or T0.6 | ADR-0002/0010 evidence; any failure has a written fallback |
| T0.11 | Spike E: Claude subscription bridge checks (09 Phase 0) | 05 §3.2 | T0.9 | ADR-0011 evidence; gate outcome recorded |
| T0.12 | Default avatar: export the CC0 VRoid preset as VRM 1.0; `assets/LICENSES.md` | 03 §1, F14 AC3 | T0.2 | File committed via LFS; licence recorded |

### Phase 1 — Kernel, protocol, text brain

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T1.1 | Plugin kernel | F39 (AC1–3) | T0.3 | Property and reactivity tests pass |
| T1.2 | Config: pydantic models for all files (§6), schema export, JSONC loader, tree diff → kernel, watcher, dedupe, atomic write, migrations framework | F30 (AC1–3) | T1.1 | ACs pass with fake plugins |
| T1.3 | Storage: SQLite event log, async writer, `user_version` migrations | F32 (AC1) | T1.1 | WAL crash test passes |
| T1.4 | Secrets plugin (keyring), `{secret}` resolution | F31 (AC1–3) | T1.2 | ACs pass |
| T1.5 | Logging + redaction filter | F36 (logs), F34 (AC2) | T0.3 | Redaction test passes |
| T1.6 | Protocol: messages (§7), server (token, Origin, topics, snapshot, rate limit, `/assets`), TS generation + drift check | F40 (AC1–3) | T1.1, T1.2 | ACs pass with a test WS client |
| T1.7 | Prompt assembly (sections as effects) + persona plugin + built-in rules | F22 (AC1–2), 07 §4 | T1.1 | Prompt snapshot tests |
| T1.8 | `ChatModel` port, normalised messages, shared contract suite, `fake` adapter | F19 (AC1 harness), F37 | T1.1 | The suite runs green on `fake` |
| T1.9 | `anthropic` adapter with every 05 §2a rule | F19 (AC1) | T1.8, T1.4 | Contract suite + append-only check (F21 AC3) |
| T1.10 | `openai_compat` adapter + presets (openai, openrouter, ollama, lmstudio, custom) | F19 (AC1) | T1.8, T1.4 | Contract suite green |
| T1.11 | `claude_subscription` adapter, text only (05 §3.2) | F19 (AC2 minus tools) | T1.8, T0.11 | No built-ins, no `~/.claude` load, streaming |
| T1.12 | Agent turn + loop (no tools yet), turn policy, conversations + context strategy per adapter, typed errors + retry policy | F20, F21 (AC1–3), 04 §4a | T1.3, T1.7, T1.9–T1.11 | ACs pass with fake and recorded providers |
| T1.13 | `svara chat` dev CLI; `--demo` text mode | F37 (AC1–2 text) | T1.6, T1.12 | A scripted demo turn passes in CI |

**Phase 1 exit (09):** the CLI chats; switching the provider in the file applies live; the kernel
tests pass.

### Phase 2 — Desktop presence (text-only)

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T2.1 | Shell app: sidecar lifecycle (01 §3a), single instance, full CLI/cold-start action contract, autostart toggle, graceful exit, crash restart | F01 (AC1–7) | T0.7, T1.6 | ACs pass |
| T2.2 | Frontend core-client (typed WS, reconnect, binary frames) + store | F40 client side | T1.6 | Reconnect test with a killed core |
| T2.3 | Production avatar window: character-only idle surface, XWayland transparency, default position, drag + persist, scale, input-region click-through, non-focusable hint, all-workspaces, indefinite/timed hide-minimise + every restore path, frame caps; no spike UI in production | F02 (AC1–8) | T2.1 | ACs pass on the dev machine; production screenshot/DOM audit contains no diagnostic panel |
| T2.4 | `packages/avatar`: VRM + VRMA load via `/assets`, framing, `avatar.json` apply in place | F14 (AC1 load path) | T2.3, T0.12 | Colour change applies ≤ 1 s |
| T2.5 | Idle behaviour | F17 | T2.4 | CPU limit met; blink distribution test |
| T2.6 | State visuals (booting, idle, thinking, error) | F04 (AC1 partial) | T2.4 | Visual within 100 ms |
| T2.7 | Complete native context menu + tray, including hide/restore, mic/voice controls, volume, workspace toggle and Quit; opt-in Show/Hide shortcut | F03 (AC1–6), F02 | T2.1 | ACs and recovery matrix pass |
| T2.8 | Bubble (text streaming, truncation, auto-hide, placement) + type box | F05 (AC1, AC3), F06 (AC1–3) | T2.2 | ACs pass |
| T2.9 | Conversations window | F07 (AC1–4) | T2.2 | ACs pass |
| T2.10 | Configure shell + Models & accounts, Persona and Shortcuts (Show/Hide now) sections; comment-preserving edits; stale-write rejection | F08 (AC1–3, those sections), F19 UI | T2.2 | ACs pass; Show/Hide shortcut can be added/removed |

### Phase 3 — Voice + performance

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T3.1 | Model download manager (manifest, SHA-256, resume, progress, remove/import) | F33 (AC1–3) | T1.6 | ACs pass |
| T3.2 | Mic plugin (`pw-record`, source selection, pre-roll, mute) | F09 (AC1, AC3) | T1.1 | `pw-record` absent in idle |
| T3.3 | Silero VAD (ONNX wrapper) + the listening flow (start/stop rules, 8 s timeout, 60 s cap) | F09 (AC2, AC4), F04 (AC2) | T3.2, T3.1 | ACs pass |
| T3.4 | STT port + `faster_whisper` + `deepgram` + contract suite + noise filter | F10 (AC1–3) | T3.3 | ACs pass |
| T3.5 | Segmenter: sentence rules, first-sentence rule, normalisation, tag extraction, reasoning/code skipping | F12 (AC3), F16 (AC2), 04 §2 | T1.12 | Unit tests |
| T3.6 | TTS port + `kokoro` runner + `elevenlabs` + contract suite (incl. alignment tier) | F12 (AC1) | T3.1, T0.8 | ACs pass |
| T3.7 | Performance engine: espeak G2P, IPA→viseme table, tiers A/B/D, shape rules, envelope | F15 (AC1) | T3.6 | Bilabial test passes |
| T3.8 | `PerformancePlayer` + retarget maps + gapless scheduling on one AudioContext + autoplay unlock | F15 (AC2–3), F12 (AC2) | T3.7, T2.4 | ACs pass |
| T3.9 | Expressions & gestures + sentiment fallback | F16 (AC1–3) | T3.8 | ACs pass |
| T3.10 | Response modes + bubble speech sync + pause voice + live output volume | F11, F12, F05 (AC2) | T3.8 | ACs pass |
| T3.11 | Barge-in + PipeWire echo-cancel setup/remove UI + duck-and-gate fallback | F13 (AC1–3) | T3.3, T3.8 | ACs pass with speakers |
| T3.12 | Lip-sync lab + golden export/load | F18 | T3.8 | A lab export passes as a golden |
| T3.13 | Latency metrics + overlay | F36 (overlay) | T3.8 | p50/p95 shown; 04 §5 targets measured and recorded |
| T3.14 | `--demo` voice path (fake STT/TTS with Tier A timings) | F37 (AC1–2) | T3.8 | CI demo turn includes a performance |

### Phase 4 — Tools, permissions, safety (v0.5 cut after T4.10)

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T4.1 | Tool registry + result caps + per-turn tool list | F23 (AC1–2) | T1.12 | ACs pass |
| T4.2 | Permission engine (rules, modes, normalisation, built-in denies, taint) | F24 (AC1–2) | T4.1 | ≥ 100-case table passes |
| T4.3 | Approval bubble, timeout, `permissions.local.json`, audit view, Permissions section | F24 (AC3–4), F08 | T4.2, T2.8 | ACs pass |
| T4.4 | Read tools: `fs.list`, `fs.read_file`, `fs.search`, `apps.*`, `system.info` | F25 (AC1 for these) | T4.2 | Limit tests pass |
| T4.5 | `screen.capture` via the portal + avatar hide + first-use consent + Privacy section | F25, F34 (AC1) | T4.4, T0.10 | F25 AC3 passes |
| T4.6 | Clipboard as surface tools (`tools.register`) | F25 | T4.2, T2.2 | Read/write tests on the dev machine |
| T4.7 | Stop: GNOME custom-shortcut setup (Shortcuts section) + kill switch | F27 | T2.1 | AC ≤ 300 ms |
| T4.8 | `claude_subscription` tools via an in-process SDK MCP server; permission enforcement in handlers | F19 (AC2) | T4.2, T1.11 | The contract test (tools = registry only) passes |
| T4.9 | Conversation boundaries (30 min, menu) end to end | F21 (AC1) | T1.12, T2.7 | AC passes |
| T4.10 | **v0.5 release:** pre-release `.deb` (09 Phase 7 packaging applied early), README draft with demo video, latency table | 12 v0.5 DoD | T4.1–T4.9 | Every v0.5 AC passes; GitHub pre-release published |
| T4.11 | Act tools: `fs.write_file`, `fs.move`, `fs.trash`, `app.open`, `url.open`, `notify` | F25 (AC1 for these) | T4.10 | Limit tests pass |
| T4.12 | `shell.exec` (off by default) | F25 | T4.11 | Limit and argv-injection tests |
| T4.13 | Phase 4 demo script end to end | F25 (AC2) | T4.12 | Demo passes on the dev machine |
| T4.14 | Computer use (experimental): portals, action set, grant cap, blocklist, thumbnails | F26 (AC1–2) | T4.13, T4.7 | ACs pass |

### Phase 5 — Extensibility & providers

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T5.1 | MCP plugin per server (stdio + HTTP), status, secrets, PATH, timeouts, restart cap, trust warning, MCP section | F28 (AC1–3) | T4.2 | ACs pass |
| T5.2 | Skills: loader, `skills.load`, limits, in-app create/edit/delete/import, Skills section | F29 (AC1–3) | T4.2 | ACs pass |
| T5.3 | `gemini` adapter | F19 (AC1) | T1.8 | Contract suite green |
| T5.4 | Remaining speech adapters: `google_stt`, `openai_stt`, `azure_tts`, `openai_tts`, `coqui` | F10 (AC1), F12 (AC1) | T3.4, T3.6 | Contract suites green |
| T5.5 | Fully offline configuration test (faster-whisper + Kokoro + Ollama) | 04 §4a | T5.4 | A scripted offline session passes with networking disabled |

### Phase 6 — Configuration complete & polish

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T6.1 | Remaining Configure sections (Voice, Features + plugin status/Retry, Advanced) | F08 | T3.x, T4.x | F08 ACs across all sections |
| T6.2 | Avatar looks editor + live preview + VRM import with licence check | F14 (AC1–2) | T2.4 | ACs pass |
| T6.3 | First-run onboarding | F35 | T6.1 | AC on a clean 24.04 VM |
| T6.4 | Retention, clear history, settings export/import | F32 (AC2), F08 | T1.3 | ACs pass |
| T6.5 | Diagnostics bundle | F36 (AC) | T1.5 | No secrets in the bundle |
| T6.6 | Finish shortcut UX (Show/Hide, Stop, push-to-talk add/change/remove and cold start), autostart toggle UI, reduced motion, multi-monitor edge cases | F09, F01, F02 | T4.7 | Manual lifecycle/control matrix passes |
| T6.7 | Error-UX pass: every 04 §4a and F-feature error path shows its specified message | 12 (all "Errors" sections) | — | A checklist of each error path is ticked |

### Phase 7 — Ship v1

| ID | Task | Implements | Depends on | Done when |
|----|------|-----------|------------|-----------|
| T7.1 | Final `.deb` packaging (PyInstaller sidecar built on 24.04, Depends list §2.2, exclude the Agent SDK's bundled CLI) + confirmed `--purge-user-data` flow for current-user files/autostart/shortcuts | F38 | all | Builds reproducibly; F38 complete-removal AC passes |
| T7.2 | Licence review, generated `THIRD_PARTY_NOTICES.md` | F38, 03 §4.7 | T7.1 | Every bundled dependency listed with its licence |
| T7.3 | Clean-VM smoke on 24.04 and 26.04 | F38 (AC) | T7.1 | AC passes |
| T7.4 | README final (demo video, architecture, lip-sync lab section, latency table, permissions, roadmap with the extension "next"), optional static web demo of `packages/avatar` | 09 Phase 7 | T7.3 | Review checklist |
| T7.5 | Publish the measurements (installer size, idle RAM/CPU, model RAM, cold start, latency p50/p95) | 09 Phase 7 | T7.3 | Table in the README |
| T7.6 | Finalise the resume bullets from what shipped | README decision | T7.4 | Bullets match the repo |
| T7.7 | Tag `v1.0.0`; GitHub Release with checksums | 12 v1 DoD | T7.1–T7.6 | Every F01–F40 AC passes |
