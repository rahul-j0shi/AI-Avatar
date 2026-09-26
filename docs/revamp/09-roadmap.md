# 09 — Roadmap: from today to desktop v1

Each phase ends with something that **runs and can be demoed**. The next phase doesn't start until
the exit criteria are met. The order is chosen so the riskiest things (transparent WebGL window, lip
sync quality, Python wheel support) are proven first.

## Portfolio-ready milestone

The plan is ordered by sequence and scope only, with no dates or durations. **Because this is for a job
search, there is an earlier cut: "v0.5 — portfolio preview"** at the end
of Phase 4a (read-only tools):

- Floating avatar, drag, context menu, bubble, conversations
- Voice in/out with the full lip-sync engine and the lip-sync lab
- Multi-provider LLM (Claude via your subscription, Claude via API key, OpenAI-compatible incl.
  OpenRouter/Ollama)
- Plugin kernel with live feature toggles
- Read-only desktop tools with the permission engine and audit log
- A `.deb` for Ubuntu 24.04/26.04, a README with demo video, and the latency table

It is released as a GitHub pre-release. The README roadmap shows Phases 4b–7 and the extension as
"next", which is honest and shows direction. Phase 7's README/demo tasks are pulled forward into
this milestone.

---

**Scope rule:** every task below implements features specified in [12](12-feature-specification.md).
A phase is done when its features' acceptance criteria pass. The v0.5 and v1 definitions of done are
at the end of 12.

## Phase 0: Reset, foundations, spikes

**Goal:** a clean repo with CI, and the three biggest unknowns answered.

Tasks
- [ ] Tag the current state `v0-prototype`. Remove `main.py`, `speech_to_text.py`, `llm_call.py`,
      `talking-head/`, `backend/`, `frontend/`, `plan.md`, `ui_plan.md`, `ARCHITECTURE.md`,
      `.env.example*`, the root `requirements.txt` (history keeps them).
- [ ] Monorepo skeleton (01 §6): `core/` uv project on Python 3.14, `apps/desktop` Tauri 2 + React +
      Vite, `packages/avatar`, `packages/protocol`, pnpm workspace, Git LFS for `*.vrm *.vrma`.
- [ ] Lint, format and type-check configs; `pytest` + `vitest` running on an empty test; GitHub
      Actions on `ubuntu-24.04` + an `ubuntu:26.04` container job.
- [ ] `docs/adr/0001…` for each decision in the README table.
- [ ] **Spike A (shell), built twice: Tauri and Electron** (02 §1.3). A transparent, frameless,
      always-on-top window through XWayland rendering a VRM with three-vrm; drag; input-region
      click-through; WebAudio playback. Measured on the **primary dev machine (Ubuntu 24.04,
      Intel/AMD graphics, default Wayland session)**; functional check on Ubuntu 26.04 in a VM.
      *Gate:* the measured criteria in 02 §1.3 decide Tauri vs Electron.
- [ ] **Spike B (lip sync):** Kokoro synthesises 5 sentences; confirm what alignment it really gives
      (phonemes? durations? word timestamps?); hand-build a viseme track; play it on the VRM.
      *Gate:* it looks convincing, or we choose the Tier B/C path for v1.
- [ ] **Spike C (deps):** install faster-whisper, kokoro-onnx/onnxruntime, silero-vad, mcp, keyring,
      `claude-agent-sdk`, `anthropic`, a D-Bus client (`jeepney`/`dbus-fast`) and PyGObject (AT-SPI) on uv-managed
      Python 3.14 on Ubuntu 24.04 and 26.04. *Gate:* all have wheels; otherwise pin 3.13 and
      write an ADR.
- [ ] **Spike D (Ubuntu desktop integration):** each "to verify" item in 02 §1.2 plus PipeWire
      echo-cancel in monitor mode (02 §1.4): always-on-top/drag under Mutter, Screenshot and
      RemoteDesktop portal grants being remembered, AT-SPI coverage, GNOME custom-shortcut → CLI
      action, clipboard from the avatar window, 100/150/200% scaling. Record results in an ADR.
- [ ] Spike C also records model sizes, RAM with models loaded, and cold-start time.
- [ ] **Spike E (Claude subscription bridge):** on the dev machine with a logged-in Claude Code,
      run `claude-agent-sdk` with the 05 §3.2 settings. Confirm: no built-in tools are offered,
      `setting_sources=[]` loads nothing from `~/.claude`, one in-process MCP tool is callable,
      partial-message streaming works, removing `ANTHROPIC_API_KEY` keeps subscription billing, and
      the first-token latency is recorded. *Gate:* if any of these fails, the Anthropic API-key adapter
      becomes the default Claude path and the finding goes in an ADR.
- [ ] Obtain the default avatar: export a CC0 VRoid preset as VRM 1.0 (03 §1); write
      `assets/LICENSES.md`.
- [ ] Record the open questions still pending (extension pairing, resume) in the README.

**Exit:** CI green (24.04 + 26.04); spikes answered and written up in ADRs; default `.vrm` committed.

---

## Phase 1: Kernel, protocol, text brain (headless)

**Goal:** the core works end to end for text, with live-swappable providers, before any UI exists.

Tasks
- [ ] `kernel`: Context, Fiber, Kernel, `emit`/`waterfall`/`serial`, `provide`/`inject`, `effect`,
      `spawn`. Property-based tests for revertibility and dependency reactivity (01 §2.3).
- [ ] `config`: pydantic models → JSON Schema export; loader → plugin tree diff → mount/unmount;
      file watcher; atomic writes.
- [ ] `storage`: SQLite event log with async writer; `secrets` via keyring.
- [ ] `providers.llm`: **`claude_subscription`** (AgentBackend, text only for now, 05 §3.2),
      `anthropic` (with the 05 §2a rules), `openai_compat` (+ OpenRouter, Ollama presets); shared contract
      tests with recorded cassettes.
- [ ] `agent`: loop without tools; prompt assembly with sections; persona plugin (`persona.md`).
- [ ] `protocol`: WS server with token auth, messages, TS type generation + drift check.
- [ ] `avatar-core chat` dev CLI that connects over the protocol (useful for tests and debugging).
- [ ] **Fake providers** (`fake` LLM/STT/TTS adapters with scripted, timed output) and a
      `--demo` flag. CI runs the full pipeline with them. Anyone can run the app with no API keys to
      see it work, which matters for recruiters and reviewers.
- [ ] Config `version` + migration framework; SQLite `user_version` migrations; first-run default
      files.
- [ ] Plugin status reporting (`plugin.status`) and failure isolation (01 §3).
- [ ] Context budget + history windowing (05 §2); typed provider errors + retry policy (04 §4a).

**Exit:** `uv run avatar-core` + the CLI streams answers; editing `config.json` to switch
OpenRouter ↔ Anthropic ↔ Ollama takes effect **without restart**; the kernel tests prove clean unmount.

---

## Phase 2: Desktop presence (text-only assistant)

**Goal:** the avatar lives on your desktop and you can chat with it by typing.

Tasks
- [ ] Tauri: start the core as a sidecar in dev (`uv run`) with the lifecycle rules in 01 §3a
      (token via env, port via stdout, stdin-close exit, crash restart with backoff, single
      instance, graceful shutdown).
- [ ] Protocol topics/routing, `snapshot` on connect, reconnect, `/assets` route (01 §4).
- [ ] Assistant state machine incl. `awaiting_approval` and "new input cancels the turn" (01 §4).
- [ ] Comment-preserving config editing from the panel (02 §7).
- [ ] Avatar window per 02 §3: bottom-right default, drag + persist, gesture recogniser, click-through
      poll, native context menu (Talk, Type, Response mode, Conversations, Configure, Exit).
- [ ] `packages/avatar`: VRM loading from `avatar.json`, framing, idle layer (blink, breathe, sway,
      saccades, cursor gaze), state-driven poses (idle / thinking / acting / error).
- [ ] Bubble (streaming text, auto-hide, "…more"), type-in box.
- [ ] Conversations window (list + transcript from event log projections).
- [ ] Tray icon (Show/Hide, Talk, Configure, Exit) as the recovery path (12 F03).
- [ ] Configure window shell with *Models & accounts* and *Persona* sections working.

**Exit:** install from a dev build, type a question, and watch the answer stream into the bubble
while the avatar looks thoughtful. Dragging, the menu and Exit all work. It survives a core crash.

---

## Phase 3: Voice + performance (the core pipeline)

**Goal:** talk to it and it talks back, with lip sync that holds up close.

3a — Voice loop
- [ ] `audio.input.pipewire` mic plugin (16 kHz, 20 ms frames, pre-roll ring buffer, source
      selection); PipeWire echo-cancel drop-in with consent (02 §1.4); AudioContext unlock on first
      gesture.
- [ ] First-use model downloads with pinned hashes, progress UI and offline behaviour (08 §6);
      lazy load / idle unload of local models.
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
- [ ] Failure handling table (04 §4a): STT/LLM/TTS errors never lose the text; noise filter.

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
- [ ] Kill switch: menu → Stop and the **global Stop hotkey** (moved here from Phase 6).
- [ ] Portal grant flows (Screenshot, later RemoteDesktop) and GNOME custom-shortcut setup, with
      status in Configure (02 §1.5); the avatar hides itself during our own screenshots.
- [ ] Privacy panel "what leaves the machine" + first-screenshot consent (05 §6).
- [ ] Trust warnings for MCP servers and imported skills (06 §6); sensitive-app blocklist for
      computer use.
- [ ] Conversation boundaries (auto new conversation after inactivity, menu item) (06 §7).
- [ ] 4d computer use behind `features.computerUse` (experimental).
- [ ] `claude_subscription` gets tools: the registry is exposed as an in-process SDK MCP server,
      and permissions are enforced inside each handler (05 §3.2). Contract test: the session's tool
      list equals our registry, with no Claude Code built-ins.

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
- [ ] MCP runtime prerequisite checks (node/uv on PATH, login-shell PATH resolution) and timeouts.
- [ ] Fully offline configuration tested end to end (faster-whisper + Kokoro + Ollama).

**Exit:** paste a Claude Desktop MCP config and its tools work with permissions; write a skill in the
app and watch the avatar use it in the next turn with no restart.

---

## Phase 6: Configuration panel complete + polish

Tasks
- [ ] All Configure sections (02 §6): Voice, Avatar looks (Monaco + live preview + VRM import),
      Skills, MCP, Permissions (editor + mode + audit), Features, Advanced.
- [ ] First-run onboarding: pick a provider (or local Ollama), test the mic, pick a voice, set the
      persona name, choose the permissions mode.
- [ ] Push-to-talk hotkey, "hide for 30 min", multi-monitor edge cases, reduced motion,
      battery-friendly frame caps.
- [ ] Error UX: every failure has a visible, human message on the avatar and a detail in the logs.
- [ ] Launch at login toggle; "hide for 30 min" menu item; avatar scale.
- [ ] Settings export/import; diagnostics bundle (logs + config without secrets + plugin statuses)
      for bug reports.

**Exit:** a new user can install, onboard and use every feature without touching a file (files stay
available for power users).

---

## Phase 7: Ship it as a portfolio project

Tasks
- [ ] Package the core with PyInstaller (or Nuitka) as a sidecar, built on Ubuntu 24.04 for glibc
      compatibility. The primary artefact is a **`.deb`** for Ubuntu 24.04 and 26.04, with declared
      dependencies (webkit2gtk-4.1 and the GStreamer plugins on the Tauri path, `espeak-ng`,
      `libayatana-appindicator`). AppImage is optional; note that its runtime forces `GDK_BACKEND=x11`,
      which we want anyway. The `.deb` also installs the `.desktop` file and icon. We could add a signed
      APT repo later.
- [ ] GitHub Release workflow on tags; optional Tauri updater.
- [ ] README: 60-second demo video/GIF, feature list, architecture diagram, "how lip sync works"
      section with the lab timeline, latency table, permissions model, "add a provider in 150 lines"
      guide, roadmap (extension next).
- [ ] Web demo page (optional): `packages/avatar` + a canned performance on GitHub Pages, so
      recruiters can see the avatar without installing anything.
- [ ] Update the resume bullets to match what was actually built (see README open question 2).
- [ ] Licence review: generated `THIRD_PARTY_NOTICES.md` for Python, JS and Rust deps; espeak-ng
      licence and source pointer; asset licences.
- [ ] Measure and publish: installer size, idle RAM/CPU, RAM with local models, cold start, latency
      p50/p95.
- [ ] Smoke test on clean Ubuntu 24.04 and 26.04 installs (a VM + one real machine with NVIDIA): install → onboard → voice turn → tool
      with approval → uninstall leaves no core process behind.

**Exit:** a tagged `v1.0.0` release with installers; README a recruiter can understand in 2 minutes.

---

## After v1 (kept visible in the README roadmap)

1. **Browser extension** (see 10).
2. More platforms: native Wayland (dropping XWayland once GNOME offers what we need), other
   distros/desktops (KDE supports layer-shell), then macOS and Windows behind the same interfaces.
3. Avatar inventory: item packages, then publish/share.
4. Wake word, multiple personas, long-term memory (summaries in SQLite + retrieval).
5. MCP resources/prompts, remote MCP OAuth.
6. Speech-to-speech realtime pipeline plugin.
7. Free-threaded Python build once all native deps support it.

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
| End to end | `--demo` mode with fake providers: a scripted run core ↔ headless avatar surface in CI (text + performance messages asserted) |
| Platform | Manual checklist on Ubuntu 24.04 + 26.04 per release (02 §1.2 items, portal grants, multi-monitor, NVIDIA) |

## Working agreement

- Small PRs per task. Every PR is green on CI and updates docs/ADRs when a decision changes.
- "Done" means tested and demoable, not just written.
- If something in this plan turns out wrong during a spike, change the plan first (ADR), then the
  code.
