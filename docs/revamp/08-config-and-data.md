# 08 — Configuration & data

## 1. Files (all in the OS config dir via `platformdirs`, e.g. `~/.config/ai-avatar/`)

```
ai-avatar/
├── config.json              # features, providers, voice, ui, agent limits
├── permissions.json         # your rules (06)
├── permissions.local.json   # "Always allow" clicks (machine-written)
├── mcp.json                 # MCP servers (07)
├── persona.md               # persona (07)
├── skills/<name>/SKILL.md   # skills (07)
├── avatar/avatar.json       # looks (03)
├── avatar/models/*.vrm
├── data/events.sqlite       # conversations + audit + metrics
└── logs/core.log            # rotating
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
    "claudeCodeBridge": false
  },
  "llm":  { "provider": "openrouter", "model": "anthropic/claude-sonnet-5", "visionModel": null },
  "providers": {
    "openrouter": { "adapter": "openai_compat", "baseUrl": "https://openrouter.ai/api/v1", "apiKey": {"secret": "openrouter"} },
    "anthropic":  { "adapter": "anthropic", "apiKey": {"secret": "anthropic"} },
    "local":      { "adapter": "openai_compat", "baseUrl": "http://localhost:11434/v1" }
  },
  "stt":  { "provider": "faster_whisper", "model": "small", "language": "auto", "vad": { "endSilenceMs": 700 } },
  "tts":  { "provider": "kokoro", "voice": "af_heart", "speed": 1.0 },
  "ui":   { "responseMode": "speak+bubble", "bubbleHideAfterSec": 8, "avatar": { "position": null } },
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

Writes are atomic (write temp + rename). Machine-written files (`permissions.local.json`, UI position)
are separate from human-edited ones, so we never rewrite your comments.

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
- Audio is **not stored** by default (a privacy default; optional debug toggle).

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
