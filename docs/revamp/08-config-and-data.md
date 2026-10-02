# 08 — Configuration & data

## 1. Files (XDG locations; defaults shown below)

```
~/.config/svara/                  # $XDG_CONFIG_HOME/svara
├── config.json              # features, providers, voice, ui, agent limits
├── permissions.json         # your rules (06)
├── permissions.local.json   # "Always allow" clicks (machine-written)
├── mcp.json                 # MCP servers (07)
├── persona.md               # persona (07)
├── skills/<name>/SKILL.md   # skills (07)
├── avatar/avatar.json       # looks (03)
└── avatar/models/*.vrm

~/.local/share/svara/events.sqlite # $XDG_DATA_HOME/svara: conversations/audit/metrics
~/.local/state/svara/logs/         # $XDG_STATE_HOME/svara: rotating logs
~/.cache/svara/models/            # $XDG_CACHE_HOME/svara: downloaded weights
```

JSON (not TOML/YAML) keeps one format everywhere: Monaco validates it natively with the JSON Schemas
we generate from the pydantic models. Comments are allowed (JSONC) and parsed with a tolerant loader.

## 2. `config.json` and feature flags

```jsonc
{
  "$schema": "./config.schema.json",
  "features": {
    "voiceInput": true, "voiceOutput": true, "bargeIn": true,
    "lipsync": true, "expressions": true, "gestures": true,
    "desktopTools": true, "computerUse": false,
    "mcp": true, "skills": true, "sentimentFallback": true,
    "bubbleAutoHide": true, "showOnAllWorkspaces": true,
    "launchAtLogin": false, "latencyOverlay": false        // the master list is 12 §0.4
  },
  "version": 1,
  "llm":  { "provider": "claude_subscription", "model": null, "effort": "low", "visionModel": null,
            "fallback": null },
  "providers": {
    "claude_subscription": { "adapter": "claude_subscription" },          // your logged-in Claude Code (05 §3)
    "openrouter": { "adapter": "openai_compat", "baseUrl": "https://openrouter.ai/api/v1", "apiKey": {"secret": "openrouter"} },
    "anthropic":  { "adapter": "anthropic", "apiKey": {"secret": "anthropic"} },
    "local":      { "adapter": "openai_compat", "baseUrl": "http://localhost:11434/v1" }
  },
  "stt":  { "provider": "faster_whisper", "model": "small", "language": "auto", "vad": { "endSilenceMs": 700 } },
  "tts":  { "provider": "kokoro", "voice": "af_heart", "speed": 1.0 },
  "ui":   {
    "responseMode": "speak+bubble", "bubbleHideAfterSec": 8,
    "micMuted": false, "voicePaused": false, "outputVolume": 1.0,
    "avatar": { "position": null, "scale": 1.0 }
  },
  "agent": { "maxSteps": 8, "maxOutputTokens": 1024, "turnTimeoutSec": 120 }
}
```

**How flags work (important for "no over-engineering"):** a flag decides whether a plugin is
**mounted**. It is not an `if` scattered through the code. `features.lipsync = false` means the
`performance` plugin isn't mounted, and the pipeline's optional inject of `performance` is empty, so it
sends segments without visemes. One mechanism, and no flag checks in business logic.

## 3. Hot reload

1. A watcher (`watchfiles`) sees a change, or the panel sends `config.patch`, which writes the file.
2. The loader parses and validates it. **Invalid → keep the old config**, and show the error in the
   panel and on the avatar ("config error") with the path and message.
3. Valid → diff the old and new plugin trees → `mount` / `unmount` / `reconfigure` only the changed
   entries.
4. Broadcast `config.changed` so all windows refresh.

A write from the panel triggers the watcher too, so the loader skips reloads whose content hash
equals the last applied one. That prevents double reloads.

**Beyond the `features` block, every plugin entry accepts `"enabled": false`** (each provider, MCP
server, skill and tool group). "The user can turn any feature on and off" is thus a property of the
loader, not a list someone has to keep complete.

Writes are atomic (write temp + rename). Permission grants live in `permissions.local.json`.
UI position lives in `config.json` under `ui.avatar.position` (F02); update only that field with
comment-preserving edits and stale-version checks, just like panel changes.

## 4. Storage: SQLite event log

One append-only table for everything that happens, plus a small conversations table. It is simple and
auditable, and the Conversations window, audit log, metrics and debugging all read from it.

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY,               -- monotonic
  conversation_id TEXT, turn_id TEXT,
  ts INTEGER NOT NULL,                  -- unix ms
  kind TEXT NOT NULL,                   -- user.text | user.transcript | assistant.text | tool.call | tool.result
                                        -- permission.decision | turn.metrics | turn.interrupted | error
  payload TEXT NOT NULL                 -- JSON
);
CREATE INDEX events_conv ON events(conversation_id, id);
CREATE INDEX events_kind ON events(kind, ts);
```

- Conversation history for the model is a **projection** of events (user/assistant/tool messages).
  It is never stored twice.
- WAL mode; writes go through one async writer task (a queue), so the event loop never blocks on disk.
- Retention setting (default: keep forever; option: 30/90 days). *Clear history* is in Advanced.
- Microphone audio is **never stored** in v1 (F09/F32); there is no debug recording toggle.

## 4a. Versioning and migrations

- JSONC files carry `"version"`, except the unchanged Claude-compatible MCP envelope. Markdown and
  MCP schema migrations are tracked by the app (13 §6.2). On startup the loader runs ordered migration functions
  (`v1 → v2 …`), writes a backup (`config.json.bak-v1`) first, and then writes the migrated file. It
  never silently drops unknown keys: they are kept, and a warning is shown.
- SQLite uses `PRAGMA user_version` with numbered migration scripts, applied in a transaction at
  startup.
- **First run:** if no config dir exists, the core writes commented default files (read-only
  permissions, local STT/TTS, no LLM provider yet) and the shell opens onboarding (Phase 6). Before
  Phase 6, the Models section of Configure is enough.
- **Export / import:** Advanced exports portable config, persona and skills (never secrets, DB,
  machine grants/shortcuts or absolute asset paths). Import previews/validates, confirms, backs up,
  and leaves imported skills disabled. Archive limits and safe extraction are defined in 14 §3.3.

## 5. Data structures used on purpose

| Where | Structure | Why |
|-------|-----------|-----|
| Kernel fiber teardown | Stack (`AsyncExitStack`) | LIFO revert of effects |
| Kernel dependency graph | Dict of service → set of dependent fibers | O(1) find-affected on provide/withdraw |
| Mic pre-roll | Ring buffer (`collections.deque(maxlen=15)` frames) | Keep the last 300 ms before VAD start |
| Pipeline stages | Bounded `asyncio.Queue` | Backpressure between LLM, TTS and playback |
| Viseme / cue tracks | Sorted immutable tuples + moving cursor | O(1) amortised per frame; trivially testable |
| Renderer segment queue | FIFO of scheduled segments with absolute start times | Gapless playback on one clock |
| Permission rules | Capability trie + compiled glob list per node | Fast match, deny-first evaluation |
| Tool registry | `dict[name, (ToolSpec, handler, fiber)]` | O(1) lookup; the owning fiber removes it |
| Event log | Append-only table + projections | Single source of truth, audit for free |
| Prompt sections | Ordered list keyed by (order, id) | Deterministic prompts; removal via effect |

## 6. Local model files (download on first use)

| Model | Approx. size | Needed for |
|-------|-------------|------------|
| Silero VAD (onnx) | ~2 MB | Voice input. Small enough to **bundle** |
| faster-whisper `small` (int8) | ~250–500 MB | Local STT (default) |
| Kokoro timestamped ONNX (fp16) + voices file | ~163 MiB + voices | Local TTS (default), Tier A timing |
| espeak-ng | few MB | System executable installed as a declared `.deb` dependency (03 §4.7) |

*The sizes are indicative; Spike C records the real numbers.*

- Models are downloaded **on first use** from their official hosts (Hugging Face / GitHub
  releases) into `$XDG_CACHE_HOME/svara/models/` (default `~/.cache/svara/models/`), **pinned by exact revision and
  SHA-256**. The hashes live in a manifest in the repo, so a changed upstream file is detected and
  refused.
- Progress is shown on the avatar ("Downloading voice… 42%") and in Configure (`model.download`
  messages). Downloads resume after interruption and are retried with backoff.
- **Offline first run:** if the download fails, voice input/output plugins go `pending: model not
  downloaded` and the app remains usable by typing. A "download models" button and a manual-import
  option (pick a file) are provided.
- The Advanced panel shows disk usage per model and offers *Remove*.
- Installers stay small (no models inside), which also keeps GitHub Release assets under their size
  limits.
