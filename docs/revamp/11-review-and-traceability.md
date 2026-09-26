# 11 — Review, traceability & risks

This document validates the plan. It checks (1) that every item on the original wishlist is covered
somewhere, (2) which gaps a critical review found and where each one is now fixed, and (3) which risks
remain open. Re-run this review at the end of every phase.

## 1. Requirements traceability

| # | Wishlist item | Where it is designed | Phase | Status |
|---|---------------|---------------------|-------|--------|
| R1 | Better design patterns, codebase, data structures | 01 (kernel, ports/adapters), 08 §5 (data structures) | 0–1 | Covered |
| R2 | No over-engineering | README principle 6; 01 §2.3 (mini kernel, not a framework); 06 §1 (no LangGraph); 03 §3 (whole-sentence segments) | all | Covered: see §4 for the "is this over-engineered?" check |
| R3 | Latest Python, for multithreading | 01 §5 (3.14 standard; asyncio for I/O; free-threading optional, with reasons) | 0 | Covered, with the premise corrected |
| R4 | Better, faster UI technology | 02 §1 (Tauri 2 + React/TS/Vite) | 0, 2 | Covered |
| R5 | Desktop app now, browser extension next; desktop ops + browser automation | 06 §4 (desktop tools), 10 (extension) | 4, post-v1 | Covered |
| R6 | Adapter pattern for the whole pipeline (LLM, STT, TTS) | 04 §4, 05 §1–2 | 1, 3, 5 | Covered |
| R7 | Use the Claude subscription (Claude only for now) | 05 §3 | 1, 4 | **Decided:** subscription first through the official Agent SDK and your own Claude Code login; API key second |
| R8 | OpenRouter, Gemini, OpenAI, Anthropic… | 05 §2 | 1, 5 | Covered |
| R9 | Avatar bottom-right by default; configurable looks and parameters | 02 §3, 03 §2 | 2, 6 | Covered |
| R10 | Float anywhere, drag and drop | 02 §3 | 2 | Covered |
| R11 | Right-click → Configure / Exit (+ Conversations) | 02 §3 | 2 | Covered |
| R12 | Config panel: model login, looks, etc. | 02 §6 | 2 (partial), 6 | Covered |
| R13 | Looks = edit code for now; inventory + publish later | 03 §2 | 6, post-v1 | Covered |
| R14 | Use DeepSeek's spatiotemporal composability for design decisions | 01 §2 | 1 | Covered |
| R15 | Everything decoupled; same thing works in the browser via extension | 01 §1, §4; 10 | post-v1 | Covered (door kept open in v1) |
| R16 | Configure the extension from the desktop panel | 10 §3.8 | post-v1 | Covered |
| R17 | Claude login mandatory, same account, for extension | 10 §3.2, 05 §4 | post-v1 | **Decided (changed)**: one-time pairing code, because third-party apps may not offer claude.ai login |
| R18 | Permissions: default read-only; JSON editor for desktop; browser like Claude for Chrome | 06 §3, 10 §3.4 | 4 | Covered |
| R19 | Double-click → listen; type area; choose speak / bubble | 02 §3–5, 04 §2 | 2–3 | Covered |
| R20 | Bubble shows current message only; Conversations shows everything | 02 §4, 02 §2 | 2 | Covered |
| R21 | Special care for phonemes/visemes, lip sync and expressions as core pipeline | 03 (whole doc) | 3 | Covered |
| R22 | Desktop first, browser next, visibly on the roadmap | 09 "After v1", 10 | 7 | Covered |
| R23 | MCP servers, load skills, write skills in-app | 07 §1–2 | 5 | Covered |
| R24 | Persona/behaviour panel | 07 §3, 02 §6 | 1, 6 | Covered |
| R25 | Everything configurable; any feature can be toggled | 08 §2 (`features` + per-entry `enabled`) | 1 | Covered |
| R26 | Better avatar tech than Ready Player Me | 03 §1 | 0 | Covered (RPM is shut down) |
| R27 | Portfolio-ready for the job search | README principle 7; 09 "v0.5 portfolio preview"; Phase 7 | 4a, 7 | Covered |
| R28 | Ubuntu only for now | 02 §1 (Wayland/XWayland decisions, portals, PipeWire), 06 §4, 09 packaging | 0–7 | Covered |
| R29 | Don't focus on language; reply in the input language | 03 §4.6 | 1, 3 | Covered |
| R30 | No dates or durations; sequence, scope and clarity only | 09 | — | Covered |
| R31 | Every feature specified in detail with hard boundaries | 12 | all | Covered |
| R32 | Implementation-ready: verified dependencies, conventions, config/protocol reference, ordered backlog | 13 | 0–7 | Covered |
| R33 | Resume bullets match what is built | 09 Phase 7, 13 T7.6 | 7 | Covered |
| R34 | Desktop presence is the avatar itself, not a dashboard/dialog/terminal/stats UI | 02 §2–3; 12 F02 AC7 | 2 | Covered; transient bubble/type/approval UI only when needed; spike controls cannot ship |
| R35 | Minimise/hide and reliably restore from tray, keyboard or terminal | 02 §3.1; 12 F01–F03 | 2 | Covered; frameless skip-taskbar semantics are explicitly “hide to tray” |
| R36 | Start/use Svara from keyboard and terminal, including when it is not running | 01 §3a; 02 §1.2, §3.1; 12 F01/F09 | 2–3 | Covered; Talk/Show/Toggle/Configure have defined cold-start behaviour |
| R37 | Turn it down/off at distinct levels | 02 §3.1; 12 F03/F11/F12/F38 | 2–7 | Covered: scale, hide, mic mute, output volume/pause, disable autostart, quit, uninstall/purge |
| R38 | Right-click access to controls and configuration | 02 §3; 12 F03 | 2 | Covered with an exhaustive native-menu order and checked state |

## 2. Gap log (review of the first version of this plan)

| # | Gap found | Severity | Fixed in |
|---|-----------|----------|----------|
| G1 | No process lifecycle: how the shell learns the core's port, orphaned cores, crash restart, single instance, shutdown | High | 01 §3a |
| G2 | No routing rule for which window receives which messages; no reconnect/resync | High | 01 §4 (topics, `snapshot`, reconnect) |
| G3 | Assistant state machine incomplete: no `awaiting_approval`, undefined behaviour for new input during a turn | High | 01 §4 state machine |
| G4 | Protocol hardening incomplete (token in URL, Origin check, frame limits) | Medium | 01 §4 hardening |
| G5 | Secrets could leak through `config.get` | High | 01 §4 (`secrets.set` write-only), 05 §5 |
| G6 | How the webview loads `.vrm` files was undefined | Medium | 01 §4 `/assets` route, 03 §2 |
| G7 | Plugin failure behaviour undefined; "why isn't X working?" had no answer | Medium | 01 §3 failure isolation, `plugin.status` |
| G8 | Third-party Python plugins: unclear whether allowed (a security hole if yes) | Medium | 01 §3 (built-in only in v1) |
| G9 | Mic in the webview, echo-cancellation quality, autoplay: unverified assumptions | High | Superseded by G41: the mic moved to the core (PipeWire), 02 §1.4 |
| G10 | Wayland breaks always-on-top and positioning | High | 02 §1.2 (the avatar window runs through XWayland; verified in Spike D) |
| G11 | OS permissions not planned | High | 02 §1.5 (portal grants, shortcuts, echo-cancel, autostart), 09 Phase 4 |
| G12 | Our screenshot tool would capture the avatar itself; the avatar shows in screen shares | Medium | 02 §1.2: hide during our own capture; screen-share exclusion is impossible on GNOME Wayland → documented + "Hide for 30 min" |
| G13 | Kill-switch hotkey was scheduled after desktop tools shipped | High (safety) | 02 §3, 09 Phase 4 |
| G14 | Bubble text vs. speech sync and tag leakage were contradictory | Medium | 02 §4 |
| G15 | Editing JSONC from the panel would destroy user comments; lost updates | Medium | 02 §7, 08 §3 |
| G16 | Segment delivery (streaming vs. whole sentence) was ambiguous | Medium | 03 §3 delivery rule |
| G17 | Tier C scheduling contradicted the roadmap; Tier D location unclear | Low | 03 §4.1 |
| G18 | Custom viseme art effort unplanned; no fallback | Medium | 03 §1 |
| G19 | Idle/gesture animation assets and their licences unplanned (Mixamo redistribution) | Medium | 03 §1 animation assets |
| G20 | VRM licence metadata ignored on import | Low | 03 §1 |
| G21 | Reply language vs. TTS voice mismatch | Medium | 03 §4.6 (voice-by-language map; bubble-only fallback) |
| G22 | GPL analysis incomplete (phonemizer loads espeak in-process; non-English G2P always uses espeak) | Medium | 03 §4.7 |
| G23 | Kokoro's PyTorch dependency would bloat the installer | Medium | 03 §4.8 |
| G24 | Segmenter behaviour at tool calls; reasoning tokens could be spoken | Medium | 04 §2 |
| G25 | No failure-handling design for STT/LLM/TTS errors or offline | High | 04 §4a |
| G26 | Google Cloud STT needs a credential file, not a key | Low | 04 §4 |
| G27 | Models without tool calling or vision; no context-window management | High | 05 §2 |
| G28 | Claude Code bridge would expose Claude Code's own Bash/Edit tools, bypassing our permissions | **Critical** | 05 §3 |
| G29 | No privacy statement of what leaves the machine; screenshots to cloud without consent | High | 05 §6 |
| G30 | Path semantics and shell-string injection in permission matching | High | 06 §3.1 (Ubuntu rules; default deny for `/proc`, `/sys`, `/dev`, removable media) |
| G31 | Trust model gaps: MCP servers and skill text run outside permissions; `allowed-tools` semantics | High | 06 §6, 07 §1–2 |
| G32 | No conversation boundary for an always-on assistant; memory undefined | Medium | 06 §7 |
| G33 | MCP servers need node/uv; GNOME-launched apps don't get the `~/.bashrc` PATH; no timeouts | Medium | 07 §1 |
| G34 | No config/DB versioning or migrations; no first-run defaults | Medium | 08 §4a |
| G35 | Local model downloads (size, integrity, offline first run) unplanned | High | 08 §6 |
| G36 | Always-on resource budget (RAM/CPU) undefined | Medium | 01 §3a |
| G37 | Executor jobs can't be cancelled (the plan implied they could) | Low | 01 §5 |
| G38 | No way to run the app without API keys (demo, CI, recruiters) | Medium | 09 Phase 1 fake providers + `--demo` |
| G39 | No earlier portfolio milestone | Medium | 09 v0.5 milestone (effort estimates were added, then removed at your request, G62) |
| G40 | No end-to-end or platform test layer; no licence review or clean-machine test | Medium | 09 testing + Phase 7 |

**Second review, after the Ubuntu-only and language decisions:**

| # | Gap found | Severity | Fixed in |
|---|-----------|----------|----------|
| G41 | Ubuntu 26.04 has **no Xorg session**, so "run under X11" is impossible. The design must work in the default Wayland session | High | 02 §1.1–1.2 (XWayland for the avatar window only) |
| G42 | Cursor-poll click-through fails under XWayland (the cursor position is stale over Wayland windows) | High | 02 §1.2: input shape region, no polling |
| G43 | `mss`/`pynput` can't see or control Wayland apps; window listing and focusing other apps are forbidden | High | 02 §1.2 and 06 §4: Screenshot/RemoteDesktop portals, AT-SPI, `gio launch` |
| G44 | Global hotkeys: an XWayland app can't grab keys; the GlobalShortcuts portal is missing on 24.04 (GNOME 46) | High | 02 §1.2: GNOME custom shortcuts → `svara --action` CLI |
| G45 | WebKitGTK risk (CPU painting under XWayland, NVIDIA blank windows) is much bigger when Linux is the *only* platform | High | 02 §1.3: Tauri vs Electron decided by measurement; NVIDIA env workaround |
| G46 | Clipboard reads need focus on Wayland; the core has no window | Medium | 06 §4: clipboard is a surface-provided tool |
| G47 | Echo cancellation for barge-in on Linux | Medium | 02 §1.4: PipeWire echo-cancel in monitor mode |
| G48 | Fractional scaling blurs XWayland windows | Low | 02 §1.2: 100%/200% supported, fractional best-effort |
| G49 | Snap-packaged Firefox/Chromium restrict native messaging (extension) | Low (post-v1) | 10 §3.7 |
| G50 | Packaging: glibc compatibility across 24.04/26.04, `.deb` dependencies | Medium | 01 §7 CI, 09 Phase 7 |

**Third review: re-verification against current docs (Agent SDK, Anthropic API) and your decisions:**

| # | Gap found | Severity | Fixed in |
|---|-----------|----------|----------|
| G51 | In the Agent SDK, `allowed_tools` only *auto-approves*, it does not restrict, and `can_use_tool` runs only when the SDK's permission flow falls through to a prompt. The earlier plan relied on both | **Critical** | 05 §3.2: `tools=[]` + `disallowed_tools`; permissions enforced inside our tool handlers; contract test |
| G52 | By default the Agent SDK loads `~/.claude` settings, skills, `CLAUDE.md`, hooks and MCP servers into the session | High | 05 §3.2: `setting_sources=[]`, empty app-owned `cwd` |
| G53 | An `ANTHROPIC_API_KEY` in the environment silently switches Claude Code from subscription to API billing | Medium | 05 §3.2: stripped from the child environment |
| G54 | Our history windowing and barge-in truncation *edit* sent history, which newer Claude models reject when it contains thinking blocks | High | 05 §2a (append-only; server compaction and context editing), 06 §1 |
| G55 | `refusal` stop reason unhandled; forced `tool_choice` would 400 | Medium | 05 §2a |
| G56 | Volatile facts (time, focused app) in the system prompt invalidate the prompt cache every turn | Low | 07 §4, 05 §2a |
| G57 | `sounddevice` can't target a specific PipeWire node (the echo-cancelled source) | Medium | 04 §1, 02 §1.4: `pw-record` subprocess |
| G58 | Cursor-following gaze is impossible outside our window under XWayland | Low | 03 §4.5 |
| G59 | Clicking the avatar steals keyboard focus from the user's app | Medium | 02 §3: non-focusable by default |
| G60 | VRoid Studio has no Linux build; default avatar source undefined | Medium | 03 §1: CC0 preset exported once; CC0 fallback pack |
| G61 | The dev machine can't measure 26.04 or NVIDIA performance | Medium | 02 §1.3 (VM functional check; NVIDIA best-effort), risk below |
| G62 | Time estimates conflicted with your "sequence and scope only" instruction | Low | 09 (estimates removed) |
| G63 | Features lacked exact boundaries (limits, defaults, out-of-scope lists, acceptance criteria), leaving room for over-engineering | High | 12 (new authoritative feature specification) |

**Fourth review: implementation readiness (package-level verification on PyPI/npm, Sep 2026):**

| # | Gap found | Severity | Fixed in |
|---|-----------|----------|----------|
| G64 | `kokoro-onnx` requires Python < 3.14 and loads GPL espeak in-process (`phonemizer`, `espeakng-loader`) | **Critical** (blocks the Python target and the licence) | 03 §4.8: own ~150-line runner on onnxruntime + the timestamped export; ADR-0009 |
| G65 | `misaki` (English G2P) requires Python < 3.13 and pulls in GPL `phonemizer-fork` + spaCy | High | 03 §4.6: espeak-ng subprocess for all languages |
| G66 | The `silero-vad` package depends on PyTorch | High | 04 §2: the ONNX model with our own wrapper |
| G67 | PyGObject has no wheels (needs system dev libraries) and is hard to bundle | Medium | 02 §1.2, 06 §4: AT-SPI and portals over `dbus-fast` |
| G68 | The Agent SDK wheel bundles a ~100 MB Claude Code CLI; shipping it would bloat the `.deb` and bypass the user's own install | Medium | 05 §3.2: `cli_path` → the user's `claude`; excluded in packaging (T7.1) |
| G69 | Kokoro Tier A timing was unconfirmed | Medium | Resolved: the timestamped ONNX export outputs `pred_dur` (03 §4.8); Spike B confirms accuracy |
| G70 | No field-level protocol payloads or complete config key list; no task-level backlog | High | 13 §6–§8 |
| G71 | No language-ID choice for typed turns | Low | 03 §4.6: `tts.defaultLanguage` (no language-ID library) |
| G72 | The shell spike's diagnostic panel could be mistaken for, or leak into, the desktop product UI | High | 02 §2 production-surface invariant; 12 F02 AC7; 09 Phase 0/2; T2.3 screenshot + DOM audit |
| G73 | “Minimise” was undefined for a frameless, skip-taskbar avatar, and Hide only had a 30-minute form | Medium | 02 §3/§3.1 and 12 F02: indefinite hide-to-tray plus tray/hotkey/CLI restore |
| G74 | Keyboard/CLI controls did not define cold-start behaviour or a Show/Hide shortcut | Medium | 01 §3a; 02 §1.2/§3.1; 12 F01 AC6–7 |
| G75 | “Turn down/off/remove” was spread across unrelated features and output volume was missing | Medium | 02 §3.1 control matrix; 08 §2; 12 F03/F11/F12/F38; 13 §6/§8 |

## 3. Risk register (what can still go wrong)

| Risk | Likelihood | Impact | Mitigation / trigger |
|------|-----------|--------|----------------------|
| WebKitGTK rendering is too slow or glitchy on Ubuntu (esp. NVIDIA) | Medium–High | High | Spike A built for both shells; Electron chosen if Tauri misses the measured bar (02 §1.3) |
| A future GNOME update changes XWayland always-on-top or positioning behaviour | Low–Medium | High | Spike D documents current behaviour; watch GNOME release notes; fallback: a small GNOME Shell extension that pins the window |
| Portal consent is not remembered on one release (repeated dialogs) | Medium | Medium | Restore tokens / permission store; if it isn't remembered, screenshots and computer use stay opt-in with a clear explanation |
| PipeWire echo-cancel drop-in conflicts with the user's audio setup | Low–Medium | Medium | Opt-in, one-click revert (remove the drop-in), headphones fallback |
| Echo cancellation is too weak for barge-in on laptop speakers | Medium | Medium | PipeWire WebRTC AEC first; then headphones-only barge-in or duck-and-gate; the feature can be toggled |
| Kokoro gives no usable timing | Low–Medium | High | Tier B via cloud TTS, or Tier C forced alignment moves into Phase 3b |
| Lip sync looks "off" despite correct data | Medium | High | Lip-sync lab + tuning parameters (lookahead, attack/release) in `avatar.json`; vrm-basic fallback |
| Anthropic changes subscription terms again | High | Medium (subscription is now the default Claude path) | Same adapter layer has the API-key path; switching is one config value; Spike E gate; re-check terms before any public release |
| Rendering or driver problems on 26.04 or NVIDIA that the dev machine can't reproduce | Medium | Medium | VM functional checks for 26.04; NVIDIA documented as best-effort with the env workaround; community bug reports triaged post-release |
| Native deps lack Python 3.14 wheels | Low | Medium | Spike C → pin 3.13 (ADR) |
| Scope creep delays the job-search deliverable | High | High | v0.5 portfolio preview cut; features beyond it go to "next" |
| Unsigned builds trigger OS warnings (SmartScreen, Gatekeeper) | High | Low | README install notes; signing when affordable |
| PyInstaller-bundled core flagged by antivirus | Medium | Medium | Nuitka as alternative; publish hashes; report false positives |
| Prompt injection via files, pages or MCP results leads to unwanted actions | Medium | High | Taint escalation (06 §5), deny-first rules, approvals, audit log |
| Solo developer bandwidth | High | Medium | Phases are independently demoable; each exit is a stopping point |

## 4. "Is this over-engineered?" check

Each piece of structure has to justify itself against a concrete requirement:

| Structure | Justified by | Verdict |
|-----------|-------------|---------|
| Plugin kernel (~300 lines) | R25 toggle anything live, R6 swap providers, R23 add MCP/skills live, R15 extension tools that vanish on disconnect | Keep: it replaces dozens of ad-hoc `if enabled` branches |
| Two processes | Python AI ecosystem + webview UI | Keep |
| Protocol codegen (pydantic → TS) | Two languages share ~25 message types | Keep: it prevents a whole class of bugs cheaply |
| Contract test suites per port | ~10 adapters | Keep |
| ADRs | Portfolio reviewers + your future self | Keep them short (≤ 1 page) |
| LangGraph, DI framework, Redux, microservices, a DB server, accounts, a cloud backend | Nothing | **Excluded** |
| Sub-sentence audio streaming, Tier C alignment, third-party Python plugins, long-term memory, wake word | Nice-to-haves | **Deferred** to post-v1 |

## 5. Still open (needs your answer)

None. All decisions are recorded in the README's *Decided* list and, from T0.4, as ADRs. Remaining
uncertainty is confined to the Phase 0 spikes, each of which has a written fallback.
