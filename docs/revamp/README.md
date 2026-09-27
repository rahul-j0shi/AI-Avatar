# Svara — Revamp Plan

This folder is the complete plan for rebuilding this repository into a **desktop-native, voice-first,
plugin-first AI assistant with an animated 3D avatar** that lives on your screen.

The previous code (`main.py`, `talking-head/`, `backend/`, `frontend/`) was a learning prototype. It
is kept in git history (tag `v0-prototype`) and was removed from `main` in Phase 0. Nothing in it is
carried forward except the idea of provider adapters.

## Project identity

**Svara** (स्वर) means voice, tone, musical note, and vowel. The name reflects the product's
voice-first design and its vowel-driven lip-sync core. These identifiers are canonical:

| Surface | Identifier |
|---|---|
| Product and desktop app | Svara |
| Command and `.deb` package | `svara` |
| Desktop app ID | `io.svara.desktop` |
| Python distribution / import | `svara-core` / `svara_core` |
| TypeScript packages | `@svara/desktop`, `@svara/avatar`, `@svara/protocol` |
| Config, data, cache, state, keyring | `svara` |
| Shell-to-core token environment variable | `SVARA_TOKEN` |

## The product in one paragraph

A small 3D character sits in the bottom-right corner of your desktop, always on top. You can drag it
anywhere. Double-click it and it listens; or type to it. It answers as a speech bubble, out loud with
accurate lip sync and facial expressions, or both. It can act on your computer through tools that sit
behind a permission system (read-only by default). It connects to any LLM provider, to MCP servers,
and loads Agent Skills that you can write inside the app. v1 runs on Ubuntu. Right-click gives you **Talk / Type /
Conversations / Configure / Exit**. Every feature can be switched on or off live. The same core will
later drive a browser extension; that is planned for, not built.

## Documents

| # | Document | What it decides |
|---|----------|-----------------|
| 01 | [Architecture](01-architecture.md) | Components, the plugin kernel (spatiotemporal composability), protocol, concurrency, repo layout |
| 02 | [Desktop shell & UI](02-desktop-shell-and-ui.md) | Electron, floating window, drag, context menu, bubble, conversations, config panel |
| 03 | [Avatar, lip sync & expressions](03-avatar-and-lipsync.md) | VRM instead of Ready Player Me, phoneme → viseme engine, expressions, gestures, looks-as-code |
| 04 | [Voice pipeline](04-voice-pipeline.md) | Mic capture, VAD, STT/TTS adapters, streaming turn orchestration, barge-in, latency budget |
| 05 | [Models & accounts](05-models-and-accounts.md) | Provider adapters, the Claude-subscription question, secrets |
| 06 | [Agent, tools & permissions](06-agent-tools-permissions.md) | Agent loop, desktop tools, JSON permission rules, approvals, audit |
| 07 | [MCP, skills & persona](07-extensibility-mcp-skills-persona.md) | MCP client, Agent Skills format, in-app skill authoring, persona |
| 08 | [Configuration & data](08-config-and-data.md) | Config files, feature flags, hot reload, storage, data structures |
| 09 | [Roadmap](09-roadmap.md) | Phases 0–7 with tasks and exit criteria, testing strategy |
| 10 | [Next: browser extension](10-next-browser-extension.md) | How the extension plugs into the same core later |
| 11 | [Review, traceability & risks](11-review-and-traceability.md) | Wishlist → design → phase map, the gap log from the plan review, the risk register, the over-engineering check |
| 12 | [Feature specification](12-feature-specification.md) | **Authoritative** per-feature scope: behaviour, in/out of scope, limits, defaults, config keys, errors, acceptance criteria |
| 13 | [Implementation guide & backlog](13-implementation-guide.md) | Verified toolchain and dependencies, repo bootstrap, conventions, ADR index, config key reference, protocol payloads, the ordered task backlog |

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
| Platform | **Ubuntu 24.04 LTS and 26.04 LTS only** (GNOME, default Wayland session; the avatar window runs through XWayland; portals for screenshots/input). Other OSes post-v1 | — |
| Desktop shell | **Electron 44 + React + TypeScript + Vite**, selected by the measured Phase 0 comparison in ADR-0006 | Streamlit, then vanilla HTML |
| Language | Language-agnostic: replies in the user's input language; lip sync via IPA phonemes works for any language espeak-ng covers; developed and tested in English | Hinglish-only prompt |
| 3D | **three.js + @pixiv/three-vrm**, **VRM 1.0** avatars | Ready Player Me (shut down 31 Jan 2026) + Babylon.js |
| Lip sync | In-house performance engine: phonemes + timings → 15-viseme track + amplitude envelope → per-avatar retarget map | TalkingHead library |
| Default TTS | **Kokoro-82M** through our own onnxruntime runner on the timestamped ONNX export (local, Apache-2.0, phoneme timings); espeak-ng subprocess for pronunciation (G2P); nothing GPL in-process. Cloud: ElevenLabs, OpenAI, Azure | MiniMax / Coqui |
| Default STT | Mic captured by the core through **PipeWire** (with its WebRTC echo cancellation) + **faster-whisper** (local) + **Silero VAD**. Cloud: Deepgram, Google Cloud STT v2, OpenAI | Whisper API with a volume threshold |
| LLM | **Claude via your subscription** (default when a logged-in Claude Code is present, through the official Agent SDK, 05 §3) · Claude via Anthropic API key · OpenAI-compatible (OpenAI, OpenRouter, Ollama, LM Studio, DeepSeek…) · Gemini. Two ports: `ChatModel` and `AgentBackend` | MiniMax / OpenAI hard-coded |
| Agent loop | Own small streaming tool-calling loop (≈200 lines) with await-able approvals | LangGraph |
| Plugins | Own mini kernel following Cordis semantics (context, services, inject, reversible effects, events) | — |
| Extensibility | MCP client (stdio + streamable HTTP, Claude-Desktop-compatible `mcp.json`), Agent Skills (`SKILL.md`), `persona.md` | — |
| Storage | JSON config + OS keychain for secrets + SQLite event log | `sessionStorage` API keys |

## Decided

- **Platform:** Ubuntu only for v1 (24.04 LTS and 26.04 LTS). See 02 §1.
- **Primary dev/demo machine:** Ubuntu 24.04 with Intel/AMD graphics. 26.04 is checked in a VM;
  NVIDIA is best-effort and untested.
- **Language:** no language-specific work. The assistant replies in the user's language. See 03 §4.6.
- **Claude:** your subscription first (through the official Agent SDK, using the Claude Code login you
  do yourself), the Anthropic API key second and used for public demos. See 05 §3.
- **Default avatar:** a CC0 VRoid preset VRM. See 03 §1.
- **Planning style:** no dates or durations. Sequence, scope and exit criteria only. See 09.
- **Extension identity:** the future extension pairs with the desktop app using a one-time code, not
  a Claude login. See 10 §3.
- **Resume:** the bullets are rewritten to match what is actually built. The draft is finalised in
  Phase 7.
- **Feature scope:** [12 — Feature specification](12-feature-specification.md) is the authoritative
  list of what v1 does and doesn't do.
- **Desktop UX:** the production desktop surface is only the floating character on transparency.
  Speech, approval, error and type UI is transient; Configure and Conversations are separate
  on-demand windows; spike controls, terminals and stats never ship. The complete start/hide/mute/
  volume/quit/uninstall recovery matrix is in 02 §3.1.

## Open questions

Paused at T0.10 for the [foundation audit](../reviews/2026-09-27-foundation-audit.md). Open gates:
Wayland on both releases, idle-focus/typing behavior, visible lip-sync accuracy and resource budgets.
T0.11/T0.12 have not started. Accepted design decisions are not completed product features.

## Research sources (checked Sep 2026)

- DeepSeek/PKU paper: [A Programming Paradigm for Spatiotemporal Composability (arXiv 2608.25512)](https://arxiv.org/abs/2608.25512)
- [DeepSeek Harness repo](https://github.com/deepseek-ai/deepseek-harness) and its [Cordis primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)
- [Cordis (cordiverse/cordis)](https://github.com/cordiverse/cordis) and the community Python port [cordis-py](https://github.com/geohotstan/cordis-py) (its README lists where it deviates from the paper)
- Ready Player Me shutdown: [Variety on the Netflix acquisition](https://variety.com/2025/digital/news/netflix-acquires-ready-player-me-games-avatar-creation-1236612915/), [Frame blog: RPM closure](https://learn.framevr.io/blog/rpm-closure)
- Claude subscription / OAuth policy: [The Register, Feb 2026](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/), [The New Stack on Agent SDK credit pools](https://thenewstack.io/anthropic-agent-sdk-credits/), [pause of the June 15 change](https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026)
- Python free-threading: [Python docs: free-threading HOWTO](https://docs.python.org/3/howto/free-threading-python.html)
- Tauri click-through: [tauri#6164 (no forward option)](https://github.com/tauri-apps/tauri/issues/6164), [DeskPet cursor-poll approach](https://github.com/Scyyyy4/deskpet/pull/3)
- Ubuntu/GNOME: [Ubuntu 26.04 drops the Xorg session (Let's Data Science)](https://letsdatascience.com/news/ubuntu-resolute-raccoon-drops-xorg-keeps-x11-apps-d88e821a), [GNOME X11 session removal FAQ](https://blogs.gnome.org/alatiera/2025/06/23/x11-session-removal-faq/), [GNOME 48 global shortcuts portal](https://release.gnome.org/48/developers/)
- WebKitGTK on Linux: [XWayland/Skia CPU painting issue](https://github.com/nukleas/cycletron/issues/8), [NVIDIA + WebKitGTK idle CPU issue](https://github.com/phase-rs/phase/issues/8614)
- PipeWire echo cancellation: [module-echo-cancel docs](https://docs.pipewire.org/page_module_echo_cancel.html)
- Claude Agent SDK: [overview (third-party login note, branding)](https://code.claude.com/docs/en/agent-sdk/overview), [Python reference](https://code.claude.com/docs/en/agent-sdk/python), [Use the Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- Avatar licensing: [VRoid FAQ: sample model conditions](https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use), [OpenGameArt VRoid CC0 models](https://opengameart.org/content/vroid-studio-cc0-models)
