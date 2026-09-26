# 09 — Roadmap: from today to desktop v1

Each phase ends with something that **runs and can be demoed**. The next phase doesn't start until
the exit criteria are met. The order is chosen so the riskiest things (transparent WebGL window, lip
sync quality, Python wheel support) are proven first.

---

## Phase 0: Reset, foundations, spikes

**Goal:** a clean repo with CI, and the three biggest unknowns answered.

Tasks
- [ ] Tag the current state `v0-prototype`. Remove `main.py`, `speech_to_text.py`, `llm_call.py`,
      `talking-head/`, `backend/`, `frontend/`, `plan.md`, `ui_plan.md`, `ARCHITECTURE.md`,
      `.env.example*`, the root `requirements.txt` (history keeps them).
- [ ] Monorepo skeleton (01 §6): `core/` uv project on Python 3.14, `apps/desktop` Tauri 2 + React +
      Vite, `packages/avatar`, `packages/protocol`, pnpm workspace, Git LFS for `*.vrm *.vrma`.
- [ ] Lint, format and type-check configs; `pytest` + `vitest` running on an empty test; GitHub
      Actions matrix (ubuntu, windows, macos).
- [ ] `docs/adr/0001…` for each decision in the README table.
- [ ] **Spike A (shell):** transparent, frameless, always-on-top Tauri window rendering a VRM with
      three-vrm at 60 fps; drag; Rust cursor-poll click-through. On every target OS.
      *Gate:* if it fails on an OS, decide: drop that OS for v1, or switch to Electron.
- [ ] **Spike B (lip sync):** Kokoro synthesises 5 sentences; confirm what alignment it really gives
      (phonemes? durations? word timestamps?); hand-build a viseme track; play it on the VRM.
      *Gate:* it looks convincing, or we choose the Tier B/C path for v1.
- [ ] **Spike C (deps):** install faster-whisper, kokoro/onnxruntime, silero-vad, mcp, keyring,
      pynput, mss on Python 3.14 for all target OSes. *Gate:* all have wheels; otherwise pin 3.13 and
      write an ADR.
- [ ] Create the default avatar in VRoid Studio; add the custom mouth expressions in Blender.

**Exit:** CI green on 3 OSes; spikes answered and written up in ADRs; default `.vrm` committed.

---

## Phase 1: Kernel, protocol, text brain (headless)

**Goal:** the core works end to end for text, with live-swappable providers, before any UI exists.

Tasks
- [ ] `kernel`: Context, Fiber, Kernel, `emit`/`waterfall`/`serial`, `provide`/`inject`, `effect`,
      `spawn`. Property-based tests for revertibility and dependency reactivity (01 §2.3).
- [ ] `config`: pydantic models → JSON Schema export; loader → plugin tree diff → mount/unmount;
      file watcher; atomic writes.
- [ ] `storage`: SQLite event log with async writer; `secrets` via keyring.
- [ ] `providers.llm`: `anthropic`, `openai_compat` (+ OpenRouter, Ollama presets); shared contract
      tests with recorded cassettes.
- [ ] `agent`: loop without tools; prompt assembly with sections; persona plugin (`persona.md`).
- [ ] `protocol`: WS server with token auth, messages, TS type generation + drift check.
- [ ] `avatar-core chat` dev CLI that connects over the protocol (useful for tests and debugging).

**Exit:** `uv run avatar-core` + the CLI streams answers; editing `config.json` to switch
OpenRouter ↔ Anthropic ↔ Ollama takes effect **without restart**; the kernel tests prove clean unmount.

---

## Phase 2: Desktop presence (text-only assistant)

**Goal:** the avatar lives on your desktop and you can chat with it by typing.

Tasks
- [ ] Tauri: start the core as a sidecar in dev (`uv run`) with the port/token handshake; restart on
      crash with backoff; stop on exit.
- [ ] Avatar window per 02 §3: bottom-right default, drag + persist, gesture recogniser, click-through
      poll, native context menu (Talk, Type, Response mode, Conversations, Configure, Exit).
- [ ] `packages/avatar`: VRM loading from `avatar.json`, framing, idle layer (blink, breathe, sway,
      saccades, cursor gaze), state-driven poses (idle / thinking / acting / error).
- [ ] Bubble (streaming text, auto-hide, "…more"), type-in box.
- [ ] Conversations window (list + transcript from event log projections).
- [ ] Configure window shell with *Models & accounts* and *Persona* sections working.

**Exit:** install from a dev build, type a question, and watch the answer stream into the bubble
while the avatar looks thoughtful. Dragging, the menu and Exit all work. It survives a core crash.

---

## Phase 3: Voice + performance (the core pipeline)

**Goal:** talk to it and it talks back, with lip sync that holds up close.

3a — Voice loop
- [ ] Mic AudioWorklet (16 kHz, 20 ms frames, pre-roll ring buffer), echo cancellation on.
- [ ] Silero VAD; turn TaskGroup with bounded queues; segmenter with tag extraction.
- [ ] STT adapters: faster-whisper (default), Deepgram. TTS adapters: Kokoro (default), ElevenLabs.
- [ ] Double-click → listen; states `listening → thinking → speaking`; response modes.
- [ ] Barge-in via cancellation; truncated message saved at the spoken word.

3b — Performance engine
- [ ] G2P (misaki + espeak-ng subprocess fallback), phoneme → viseme table, Tier A and B timing,
      Tier D real-time fallback, shape rules, envelope.
- [ ] `PerformancePlayer` with lookahead, attack/release, closure dominance, envelope jaw gain,
      expression blending; retarget maps `vrm-extended`, `vrm-basic`.
- [ ] Expression and gesture cues from tags; sentiment fallback; VRMA gesture clips (wave, nod,
      shrug).
- [ ] Lip-sync lab (03 §6) + golden tests + bilabial closure test on 30 sentences.
- [ ] Latency metrics per stage + debug overlay.

**Exit:** a full spoken conversation, hands-free; bilabial test passes; p50 speech-end → first audio
≤ 2.0 s with the default local STT/TTS and a cloud LLM; barge-in works reliably with speakers (not
just headphones).

---

## Phase 4: Agent with desktop tools & permissions

**Goal:** it does things, safely.

Tasks
- [ ] Tool registry + `tool.before_call` waterfall + permission engine (rules, modes, path
      normalisation) + exhaustive unit tests (a table of ~100 rule/call → decision cases).
- [ ] Approval bubble, timeout = deny, `permissions.local.json`, audit log view.
- [ ] 4a read tools → 4b act tools → 4c `shell.exec`. Taint escalation for untrusted content.
- [ ] Vision: screenshot → vision model (role `vision` or `main` if capable).
- [ ] Kill switch (Esc / menu → Stop).
- [ ] 4d computer use behind `features.computerUse` (experimental).

**Exit:** demo script: *"What's the biggest file in my Downloads?"* (read, no prompt) → *"Move it to
Documents/Archive"* (approval bubble) → *"Open it"* → *"Delete my SSH keys"* (denied by rule, and the
avatar explains why). All decisions show in the audit log.

---

## Phase 5: Extensibility — MCP, skills, more providers

Tasks
- [ ] MCP plugin per server (stdio + streamable HTTP), `mcp.json` compatible with Claude Desktop,
      live status, per-server toggle, `${secret:…}` resolution.
- [ ] Skills: loader, progressive disclosure via `skills.load`, per-skill toggle, in-app editor with
      template and validation.
- [ ] `gemini` ChatModel adapter; Google Cloud STT v2 and Azure TTS (viseme events) adapters.
- [ ] Experimental `claude_code` AgentBackend (05 §3), off by default, with our tools via an
      in-process MCP server and our permission callback.

**Exit:** paste a Claude Desktop MCP config and its tools work with permissions; write a skill in the
app and watch the avatar use it in the next turn with no restart.

---

## Phase 6: Configuration panel complete + polish

Tasks
- [ ] All Configure sections (02 §6): Voice, Avatar looks (Monaco + live preview + VRM import),
      Skills, MCP, Permissions (editor + mode + audit), Features, Advanced.
- [ ] First-run onboarding: pick a provider (or local Ollama), test the mic, pick a voice, set the
      persona name, choose the permissions mode.
- [ ] Tray icon, push-to-talk hotkey, "hide for 30 min", multi-monitor edge cases, reduced motion,
      battery-friendly frame caps.
- [ ] Error UX: every failure has a visible, human message on the avatar and a detail in the logs.

**Exit:** a new user can install, onboard and use every feature without touching a file (files stay
available for power users).

---

## Phase 7: Ship it as a portfolio project

Tasks
- [ ] Package the core with PyInstaller (or Nuitka) as a Tauri sidecar per OS. Tauri bundles: `.msi`,
      `.dmg`, `.AppImage`/`.deb` (per the OS decision). Note code signing (unsigned builds need a
      README warning).
- [ ] GitHub Release workflow on tags; optional Tauri updater.
- [ ] README: 60-second demo video/GIF, feature list, architecture diagram, "how lip sync works"
      section with the lab timeline, latency table, permissions model, "add a provider in 150 lines"
      guide, roadmap (extension next).
- [ ] Web demo page (optional): `packages/avatar` + a canned performance on GitHub Pages, so
      recruiters can see the avatar without installing anything.
- [ ] Update the resume bullets to match what was actually built (see README open question 5).

**Exit:** a tagged `v1.0.0` release with installers; README a recruiter can understand in 2 minutes.

---

## After v1 (kept visible in the README roadmap)

1. **Browser extension** (see 10).
2. Avatar inventory: item packages, then publish/share.
3. Wake word, multiple personas, long-term memory (summaries in SQLite + retrieval).
4. MCP resources/prompts, remote MCP OAuth.
5. Speech-to-speech realtime pipeline plugin.
6. Free-threaded Python build once all native deps support it.

---

## Testing strategy (applies to every phase)

| Layer | Tests |
|-------|-------|
| Kernel | Property-based revertibility + reactivity (Hypothesis) |
| Adapters | Shared contract suites per port, recorded HTTP cassettes (no network in CI) |
| Pipeline | Fake STT/LLM/TTS adapters with scripted timings; assert event order, cancellation, backpressure |
| Performance | Golden viseme tracks; bilabial closure metric; `PerformancePlayer.update` vitest goldens |
| Permissions | Table-driven decision tests incl. path traversal and symlinks |
| Protocol | Schema drift check; round-trip (Python → JSON → TS types) |
| UI | Component tests for bubble/menu logic; manual demo checklist per phase (no heavy e2e in v1) |

## Working agreement

- Small PRs per task. Every PR is green on CI and updates docs/ADRs when a decision changes.
- "Done" means tested and demoable, not just written.
- If something in this plan turns out wrong during a spike, change the plan first (ADR), then the
  code.
