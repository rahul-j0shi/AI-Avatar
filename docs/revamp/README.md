# AI Avatar — Revamp Plan

This folder is the complete plan for rebuilding this repository into a **desktop-native, voice-first,
plugin-first AI assistant with an animated 3D avatar** that lives on your screen.

The current code (`main.py`, `talking-head/`, `backend/`, `frontend/`) is a learning prototype. It is
kept in git history (tag `v0-prototype`) and removed from `main` in Phase 0. Nothing in it is carried
forward except the idea of provider adapters.

## The product in one paragraph

A small 3D character sits in the bottom-right corner of your desktop, always on top. You can drag it
anywhere. Double-click it and it listens; or type to it. It answers as a speech bubble, out loud with
accurate lip sync and facial expressions, or both. It can act on your computer through tools that sit
behind a permission system (read-only by default). It connects to any LLM provider, to MCP servers,
and loads Agent Skills that you can write inside the app. Right-click gives you **Talk / Type /
Conversations / Configure / Exit**. Every feature can be switched on or off live. The same core will
later drive a browser extension; that is planned for, not built.

## Documents

| # | Document | What it decides |
|---|----------|-----------------|
| 01 | [Architecture](01-architecture.md) | Components, the plugin kernel (spatiotemporal composability), protocol, concurrency, repo layout |
| 02 | [Desktop shell & UI](02-desktop-shell-and-ui.md) | Tauri, floating window, drag, context menu, bubble, conversations, config panel |
| 03 | [Avatar, lip sync & expressions](03-avatar-and-lipsync.md) | VRM instead of Ready Player Me, phoneme → viseme engine, expressions, gestures, looks-as-code |
| 04 | [Voice pipeline](04-voice-pipeline.md) | Mic capture, VAD, STT/TTS adapters, streaming turn orchestration, barge-in, latency budget |
| 05 | [Models & accounts](05-models-and-accounts.md) | Provider adapters, the Claude-subscription question, secrets |
| 06 | [Agent, tools & permissions](06-agent-tools-permissions.md) | Agent loop, desktop tools, JSON permission rules, approvals, audit |
| 07 | [MCP, skills & persona](07-extensibility-mcp-skills-persona.md) | MCP client, Agent Skills format, in-app skill authoring, persona |
| 08 | [Configuration & data](08-config-and-data.md) | Config files, feature flags, hot reload, storage, data structures |
| 09 | [Roadmap](09-roadmap.md) | Phases 0–7 with tasks and exit criteria, testing strategy |
| 10 | [Next: browser extension](10-next-browser-extension.md) | How the extension plugs into the same core later |
| 11 | [Review, traceability & risks](11-review-and-traceability.md) | Wishlist → design → phase map, the gap log from the plan review, the risk register, the over-engineering check |

## Design principles

1. **Everything is a plugin, and every plugin can be unmounted cleanly.** Providers, tools, MCP
   servers, skills, persona and features are all plugins mounted into one kernel. Turning a feature off
   unmounts it and reverts everything it registered. This is the *spatiotemporal composability*
   model from DeepSeek/PKU (details in 01), used at the scale this project needs: a small in-house
   kernel, not a framework.
2. **Ports and adapters at every external boundary.** LLM, STT, TTS, avatar renderer, surface (desktop
   vs extension), and storage are interfaces. No core code imports a vendor SDK.
3. **Streaming end to end.** Nothing waits for a whole response. Tokens stream into sentences, which
   stream into audio and viseme tracks.
4. **One clock for audio and face.** Audio playback, visemes and expressions are scheduled on the same
   `AudioContext` clock in the renderer. Lip sync is part of the core pipeline, not a UI effect.
5. **Safe by default.** Read-only permissions by default. Every write or exec action goes through a
   policy check, and an approval if the policy says so. Everything is audited.
6. **No over-engineering.** One Python process, one desktop shell, SQLite, JSON config files. No
   microservices, no server, no accounts, no DI framework beyond the ~300-line kernel, no LangGraph,
   no state-management library.
7. **Portfolio quality.** Typed code, tests that prove the hard parts (kernel revertibility, permission
   engine, viseme timing), CI, measured latency, a clear README with a demo video, and ADRs.

## Key decisions at a glance

| Topic | Decision | Replaces |
|------|----------|----------|
| Core language | Python **3.14** (standard build), `asyncio` + `TaskGroup`, `uv` | Python 3.7+ scripts |
| Parallelism | asyncio for I/O; native inference in a thread pool (native code releases the GIL). Free-threaded `3.14t` stays an opt-in experiment | "use new Python for multithreading" |
| Desktop shell | **Tauri 2** (Rust) + **React + TypeScript + Vite**; fall back to Electron only if the Phase 0 spike fails on a target OS | Streamlit, then vanilla HTML |
| 3D | **three.js + @pixiv/three-vrm**, **VRM 1.0** avatars | Ready Player Me (shut down 31 Jan 2026) + Babylon.js |
| Lip sync | In-house performance engine: phonemes + timings → 15-viseme track + amplitude envelope → per-avatar retarget map | TalkingHead library |
| Default TTS | **Kokoro-82M** (local, Apache-2.0, gives phonemes and timings). Cloud: ElevenLabs, OpenAI, Azure | MiniMax / Coqui |
| Default STT | **faster-whisper** (local) + **Silero VAD**. Cloud: Deepgram, Google Cloud STT v2, OpenAI | Whisper API with a volume threshold |
| LLM | Own `ChatModel` port: Anthropic (API key), OpenAI-compatible (OpenAI, OpenRouter, Ollama, LM Studio, DeepSeek…), Gemini. Plus an experimental `AgentBackend` bridge to the user's own Claude Code install | MiniMax / OpenAI hard-coded |
| Agent loop | Own small streaming tool-calling loop (≈200 lines) with await-able approvals | LangGraph |
| Plugins | Own mini kernel following Cordis semantics (context, services, inject, reversible effects, events) | — |
| Extensibility | MCP client (stdio + streamable HTTP, Claude-Desktop-compatible `mcp.json`), Agent Skills (`SKILL.md`), `persona.md` | — |
| Storage | JSON config + OS keychain for secrets + SQLite event log | `sessionStorage` API keys |

## Open questions for you

These change the plan, so I need your answer on them. Each is also listed in the relevant document.

1. **Target OSes for v1.** Windows + macOS only, or Linux too? Linux WebKitGTK makes transparent WebGL
   windows the riskiest part of Tauri (see 02).
2. **The Claude subscription.** Anthropic's terms do not allow a third-party app to use Claude
   Free/Pro/Max OAuth tokens. The only compliant subscription path is driving the **official Claude Code
   CLI** that you log into yourself, and Anthropic's policy and billing for that path changed several
   times in 2026 (see 05). Proposal: Anthropic **API key** is the supported Claude path, and the Claude
   Code bridge is an experimental, off-by-default adapter. OK?
3. **"Claude login mandatory, same account" for extension sync.** Because of (2) the app can't use
   the Claude account as its identity. Proposal: the extension pairs with the local desktop core using a
   one-time pairing code (see 10). OK?
4. **Hinglish.** Is Hinglish/Hindi still a goal for v1, or English first with Hinglish as a milestone?
   It changes G2P and voice choice a lot (see 03, 04).
5. **Resume alignment.** The plan swaps Babylon.js → three.js, Ready Player Me → VRM, Coqui → Kokoro
   (Coqui kept as an optional adapter), LangGraph → own loop. The resume bullets should be updated to
   match what gets built, because interviewers will open the repo.

## Research sources (checked Sep 2026)

- DeepSeek/PKU paper: [A Programming Paradigm for Spatiotemporal Composability (arXiv 2608.25512)](https://arxiv.org/abs/2608.25512)
- [DeepSeek Harness repo](https://github.com/deepseek-ai/deepseek-harness) and its [Cordis primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)
- [Cordis (cordiverse/cordis)](https://github.com/cordiverse/cordis) and the community Python port [cordis-py](https://github.com/geohotstan/cordis-py) (its README lists where it deviates from the paper)
- Ready Player Me shutdown: [Variety on the Netflix acquisition](https://variety.com/2025/digital/news/netflix-acquires-ready-player-me-games-avatar-creation-1236612915/), [Frame blog: RPM closure](https://learn.framevr.io/blog/rpm-closure)
- Claude subscription / OAuth policy: [The Register, Feb 2026](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/), [The New Stack on Agent SDK credit pools](https://thenewstack.io/anthropic-agent-sdk-credits/), [pause of the June 15 change](https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026)
- Python free-threading: [Python docs: free-threading HOWTO](https://docs.python.org/3/howto/free-threading-python.html)
- Tauri click-through: [tauri#6164 (no forward option)](https://github.com/tauri-apps/tauri/issues/6164), [DeskPet cursor-poll approach](https://github.com/Scyyyy4/deskpet/pull/3)
