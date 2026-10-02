# 14 — Acceptance, integration and remaining gates

Planning checkpoint: **2026-10-02**. This completes the execution plan, not the implementation.
The [foundation audit](../reviews/2026-09-27-foundation-audit.md) remains the evidence of work done.
No F01–F40 feature is accepted yet. Nothing here waives the open platform, accuracy or performance
gates. [12](12-feature-specification.md) controls product scope; [13](13-implementation-guide.md)
controls task dependencies. This document assigns tests and resolves their integration boundaries.

## 1. Decisions and scope

- **User decision:** remove Coqui from v1. Keep local Kokoro and cloud ElevenLabs, Azure and OpenAI
  TTS. No extra local service, PyTorch dependency or automatic runtime installation.
- Keep all R1–R38 wishlist items and all F01–F40 features otherwise. Desktop idle is **only the
  character**, never a dashboard, terminal, permanent dialog or metrics panel. Debug/lab surfaces
  are opt-in and separate; production build checks must prove the spike page is excluded.
- The keyboard Talk action toggles one utterance; it is not a key-held microphone. All three
  global shortcuts are opt-in, rebindable, removable, and preserve unrelated GNOME bindings.
- No silent paid-provider switch, no automatic subscription test consuming usage, and no implicit
  permission to publish a release. Local testing and branch/main merges remain the working scope.
- Browser extension, inventory/publishing, wake word, memory and other platforms remain post-v1.
  They are not missing desktop tasks. The extension's bounded follow-up milestones are in 10.
- Planning is complete when requirements have owners, dependency order, tests and failure decisions.
  It cannot guarantee a compositor/API experiment succeeds. A failed gate stops dependent work;
  changes to scope or budgets require the user's decision, not a checkbox tick.

## 2. Phase 0 decision gates

The implementer of the named task owns its evidence. Each result records commit, lockfile versions,
OS/session/GPU, command or manual steps, expected/observed result, and artifact paths. Unknown is
not pass. Temporary test changes are restored; don't install services, capture mic audio, alter
shortcuts, log into accounts or consume API usage without the relevant explicit consent.

| Gate | Owner / prerequisites | Pass and failure decision |
|---|---|---|
| G-PRESENCE | T0.10; real GNOME Wayland sessions on 24.04 and 26.04, pointer/keyboard access | Prove above/drag/input rectangles, idle non-focus-stealing, Type and approval keyboard focus, closing transient UI, workspace/scaling and restore together. Try managed X11 input hints first, then an owned transient focusable surface visually anchored to the avatar. Both must preserve F02/F06 UX. No reliance on Linux `setFocusable` toggling. If neither passes, stop and propose an ADR; no automatic GNOME extension or dashboard fallback |
| G-PLATFORM | T0.10; same sessions, consent for portal dialogs and temporary shortcuts | Complete the matrix in 02 §1.2: screenshot, RemoteDesktop/ScreenCast, AT-SPI, clipboard, cold/warm shortcut, 100/150/200% scaling. Record denied/revoked/missing-service cases as well as success. Repeated portal prompts are supported, not a promise of remembered grants; unavailable focused-app identity denies computer input. Mandatory unavailable behavior blocks its task/release |
| G-AEC | T0.10 transport/setup, T3.11 acoustic acceptance; speakers and mic consent | Monitor-mode source usable and reversibly installed; then F13's 10-minute zero-self-interruption and stop tests. Duck-and-gate is the already-specified degraded path, never an AEC pass. If speakers still fail, F13 remains unaccepted; ask before changing its promise |
| G-TIMING | T0.8, then T3.7/T3.8/T3.12 | First rerun the corrected five-sentence spike with measured visible mouth/audio landmarks. Duration extraction alone is not accuracy. Prefer timestamped Kokoro Tier A; if inadequate evaluate existing Tier B/D paths. Tier C would need its own dependency/license ADR and user-approved scope change. Full 30-sentence metric remains a Phase 3 gate |
| G-BUDGET | T0.10 initial baseline; T2.11/T3.15 final workloads | Record §5 measurements. Optimize within selected Electron/ONNX design; no budget waiver or unmeasured claim. If still failing, stop dependent acceptance and present measured tradeoffs |
| G-SUBSCRIPTION | T0.11; locked SDK, user-installed CLI, external user login and consent for minimal test | Prove settings isolation with harmless sentinels, exact tool list, streaming, cancellation, handler enforcement, session continuity, non-secret auth provenance and first-token latency. Unknown CLI/isolation failure → pending, never allow built-ins. Policy/distribution uncertainty blocks subscription release claims; API-key use requires explicit choice. Recheck at each release |
| G-ASSETS | T0.12; source and redistribution evidence | Commit named CC0 default VRM plus license/source/hash and modification metadata. Gesture assets need redistribution evidence too (T3.9); otherwise create the three simple motions locally. Do not assume a preset/export is automatically CC0 |
| G-FOUNDATION | T0.13; all T0 tasks and audit corrections | Record passed evidence or explicitly approved design changes for every foundation gate. Containers prove dependency compatibility only, never Wayland. Missing VM/session/account evidence means blocked on that prerequisite; independent read-only planning can proceed, Phase 1 cannot |

Electron's [BrowserWindow reference](https://www.electronjs.org/docs/latest/api/browser-window)
lists runtime focusability setters for macOS/Windows, so a Linux focus strategy requires the actual
gate above. The transient-surface option is an implementation candidate, not a change to inline UX
and not a claimed working solution.

## 3. Cross-feature contracts

### 3.1 Lifecycle, visibility and microphone safety

The shell owns window/tray/shortcut state; the core owns turns, mic, tools and audio generation.
Hiding stops render frames, not the audio clock. Timed hide is session-only; explicit restore cancels
its timer, a second timed hide restarts it, and app restart starts visible. Configure/Conversations
close independently and never keep a supposedly quit core alive. An unavailable tray produces a
warning before first hide with the CLI restore command; no trapped hidden instance.

| Action during work | Required result | Regression owner / ID |
|---|---|---|
| Hide during speech | Audio may continue, renderer 0 fps; disable barge-in mic while hidden because there is no visible mic indicator; restore samples current audio time, never replays | T3.15 / X01 |
| Hide while listening | End listening without submitting partial captured audio; close mic immediately; no hidden recording | T3.15 / X02 |
| Hide during approval | Never auto-approve. Timeout keeps running and denies; tray tooltip indicates pending approval and Show restores the same request | T4.15 / X03 |
| Mute mic / disable voiceInput | Close mic, discard an incomplete utterance, suppress barge-in until re-enabled; turning it on does not start capture | T3.15 / X04 |
| Pause voice / disable voiceOutput / select Bubble only | Stop queued/current speech and synthesis; keep generated text and tool work, reveal remaining text; no replay when re-enabled. Volume 0 instead preserves playback timing | T3.10 / X05 |
| Stop / new input / new conversation | Cancel old turn and permissions, invalidate old audio/tool callbacks by turn generation; persist partial text and completed effects. New conversation starts only after cancellation fencing | T4.0/T4.7 / X06 |
| Renderer/core disconnect or sleep | Renderer stops audio immediately; core closes mic, cancels turn and pending approvals. Keep completed records, reconnect to fresh snapshot; never resume audio or replay effects automatically | T2.2/T3.15/T4.15 / X07 |
| Quit / purge / uninstall | Graceful shutdown bound, child cleanup, no later provider/tool output. Purge lists exact current-user targets and confirms; ordinary uninstall retains user data, never traverses other users | T2.1/T7.1/T7.3 / X08 |

For hidden work, F04's mic rule still holds: no visible mic indicator means no mic. Hide is not
Stop, and Show is not Talk. No state transition or reconnect may initiate listening by itself.

### 3.2 Turn, playback and configuration ownership

- Turn IDs are globally unique for a core session; segment/stream IDs are not reused on that
  connection. Every asynchronous result is checked against the active generation before publishing.
- `assistant.done` means generation ended, not playback finished. Remain speaking until the renderer
  acknowledges the last segment. Its progress supplies the last fully spoken word for interruption
  notes; unknown progress is reported as unknown, not guessed from text-generation position.
- Synthesis credit counts generated, transferred and queued sentences together: at most two ahead
  of the currently playing segment. Credit returns on playback completion/discard, not socket send.
  A stalled player times out after 5 s without progress while expected to play; stop speech and
  show the text. Allow the current bounded synthesis operation to finish but drop stale output.
- Config edits validate and persist atomically. Voice/model/provider changes apply to the next
  utterance/turn; security revocations and off/mute/stop apply immediately. Snapshot the selected
  provider and limits per turn; never mix providers inside an already-started response.
- Turning a plugin off withdraws its registrations immediately. Pending approvals for it deny;
  in-flight handlers receive cancellation. Already-completed external effects cannot be undone.
  Late non-cancellable native inference is discarded and cannot re-register a disposed plugin.
- On cloud failure, fallback only before any output/effect, only to explicitly configured fallback,
  visibly named. After partial output, retain it and end; never repeat a write/tool through retry.
- Approval applies to the canonical tool arguments/resource shown. Revalidate at execution,
  including symlink/path changes and current denies; approval cannot authorize modified arguments.
  Serialize state-mutating tools even when the model requests a parallel group; read tools may
  overlap, and all results return in one step message.
- `clipboard.read` uses explicit focused Type/approval interaction if required by the compositor;
  idle avatar clicks must not be made focus-stealing to satisfy a clipboard test. Return a clear
  instruction when unavailable. Do not paste/capture unrelated clipboard data in tests.

Tests: T1.12/T4.0 own generation fencing and complete tool groups (**X09**); T3.8 owns credit,
stalled playback and progress (**X10**); T1.2 plus each plugin owns live reconfiguration and cleanup
(**X11**); T4.2 owns revalidation/serialization (**X12**).

### 3.3 Data, configuration and transport edges

- Shell IPC exposes named operations, not arbitrary filesystem paths, commands or URLs. Verify
  sender window and arguments. Native file pickers issue one-use handles; the core resolves only
  those approved handles. Model-supplied arguments cannot invoke settings/import/secret APIs.
- Generated protocol schemas define every discriminated request/result/event. Unknown operations,
  unexpected fields, invalid numeric ranges, wrong origin/role/token and oversized data fail closed.
  UI-management endpoints are not model tools. Session IDs are not authentication credentials.
- Asset access allows only installed bundled assets and imported avatar roots; reject traversal,
  encoded traversal, symlinks outside roots and remote texture URLs. No arbitrary local-file fetch.
  Renderer receives no general core-control token; the shell routes permitted requests by surface.
- Downloads use fixed manifest hosts, revision/hash, byte limits and temporary files. Resume checks
  file identity; mismatch restarts/refuses. Import checks the same manifest; remove unloads safely
  or asks to cancel the active turn, never deletes an in-use file silently.
- Settings export excludes secrets, DB, machine-specific grants/shortcuts, absolute avatar paths
  and model binaries. Preserve portable configuration/persona/skills; missing assets/secrets become
  explained pending states. Import has preview/confirmation, stages validation before applying,
  rejects zip-slip/symlinks and more than 50 MB expanded or 1,000 entries, and backs up replaced
  config. Imported skills start disabled; permission grants and autostart/shortcuts are not enabled
  by importing someone else's configuration. Reset settings also confirms and preserves history.
- Daily retention removes entire conversations whose last event is older than the cutoff, not half
  a tool-call pair; never remove an active turn. Clear/delete active conversation cancels it first.
  Settings/diagnostic exports redact unknown-key values that resemble credentials as well as known
  secret fields. Logs contain no raw microphone audio or secret values. Disable optional vendor
  telemetry in native runtimes/SDKs (including ONNX Runtime) before initialization and test no
  unexpected egress; Svara's no-telemetry promise includes bundled dependencies.
- Subscription session artifacts are inventoried in T0.11: keep Svara-owned artifacts under its
  XDG state root where supported; do not delete global Claude login/settings/history during purge.
  Explain any vendor-managed records that Svara cannot remove. Cannot promise complete removal of
  Svara-created records until the packaging test verifies actual ownership and cleanup.

Tests: T1.6/T2.1 **X13** (IPC/transport/roles/assets), T3.1 **X14** (download lifecycle), T6.4 **X15**
(safe import/export/retention), T1.5/T6.5 **X16** (redaction), T0.11/T7.3 **X17** (owned data cleanup).

## 4. Acceptance ledger — every AC has an owner

IDs are stable: `AC-Fnn.k` for the kth numbered criterion in 12; an unnumbered AC is `.1`.
Ranges below are inclusive. Each expands to an individual test record; this is **planned coverage**,
not evidence of existing tests. `A` = automated local unit/contract/integration; `M` = manual local
desktop check on both supported Wayland releases where platform behavior matters. Test artifacts
record PASS/FAIL/BLOCKED, commit, command/steps and observations. CI runs fake/offline suites only.

An early task may finish its isolated harness/fixture checks without accepting a complete feature.
Final acceptance occurs at the last applicable owner below. T4.10/T7.7 replay the milestone ledger.
Recorded provider fixtures verify adapter contracts, not live credentials, policy or provider SLA.

| Feature | AC IDs | Owners and verification |
|---|---|---|
| F01 | AC-F01.1–7 | T2.1: .1/.3/.4/.5/.7 A+M; T3.15: .2/.6 real listening and cold-start A+M; T6.6 full shortcut/login matrix |
| F02 | AC-F02.1–8 | T2.3: .1–5/.7/.8 isolated window checks; T2.11: all against real avatar, including .6 CPU A+M; T6.6 monitor/workspace matrix |
| F03 | AC-F03.1–6 | T2.7: .2–5 and text-ready actions A+M; T3.15/T4.15: .1/.6 all voice/Stop/approval actions and persistence A+M |
| F04 | AC-F04.1–2 | T2.6 text visuals; T3.15 .1/.2 voice states A+M; T4.15 .1 acting/approval and mic closure A+M |
| F05 | AC-F05.1–3 | T2.8 .1/.3 A; T3.10 .2 timed words A+M |
| F06 | AC-F06.1–3 | T2.8 all A+M; T4.3 replays blocked-during-approval case |
| F07 | AC-F07.1–4 | T2.9 all with persisted fixture tool rows A+M; T4.15 real tool/approval rows integration |
| F08 | AC-F08.1–3 | T2.10 first sections; T6.1 all sections A+M, including T4.3/T4.5/T5.1/T5.2/T6.2/T6.4 controls |
| F09 | AC-F09.1–4 | T3.2 .1/.3; T3.3 .2/.4; T3.15 assembled capture A+M; T6.6 keyboard/CLI |
| F10 | AC-F10.1–3 | T3.4 .1 initial adapters/.2/.3 A+M; T5.4 .1 remaining adapters before preview A |
| F11 | AC-F11.1 | T3.10 modes A+M; T4.3 actual approval in Speak only |
| F12 | AC-F12.1–3 | T3.6 .1 initial adapters; T5.4 .1 remaining adapters A; T3.8 .2 A+M; T3.5 .3 A |
| F13 | AC-F13.1–3 | T3.11 .1/.2 speaker trials M; .3 A; T3.15 replay complete pipeline |
| F14 | AC-F14.1–3 | T2.4 .1 A+M; T6.2 .2 A+M before preview; T0.12 .3 source/license inspection |
| F15 | AC-F15.1–3 | T3.7 .1 annotated goldens A; T3.8/T3.12 .2 calibrated lab M and .3 A; T3.15 real avatar replay |
| F16 | AC-F16.1–3 | T3.9 .1/.3 A+M; T3.5 .2 A |
| F17 | AC-F17.1 | T2.5 distribution A; T2.11 CPU M |
| F18 | AC-F18.1 | T3.12 export→golden round trip A+M |
| F19 | AC-F19.1–3 | T1.9/T1.10/T5.3 .1 per adapter A; T0.11/T1.11/T4.8 .2 A+consented M; T2.10 .3 A+M |
| F20 | AC-F20.1–3 | T4.0 .1/.3 A; T3.15 .2 A+M; T1.12 text-only cancellation/timeout harness is preparatory |
| F21 | AC-F21.1–3 | T1.12 .1–3 scripted budget/append-only A; T4.9 .1 UI boundary M; T4.15 .2/.3 with tools A |
| F22 | AC-F22.1–2 | T1.7 prompt fixtures A; T2.10 editor/test/name presentation A+M |
| F23 | AC-F23.1–2 | T4.1 registry-owned fake MCP fiber .1 and caps .2 A; T5.1 real process unmount rerun |
| F24 | AC-F24.1–4 | T4.2 .1/.2 A; T4.3 .3/.4 A+M; T4.15 handler/approval integration |
| F25 | AC-F25.1–3 | T4.4/T4.5/T4.6/T4.11/T4.12 .1 every tool row limit A+M; T4.13 .2 M; T4.5 .3 M |
| F26 | AC-F26.1–2 | T4.14 fake portal A plus real consented portal/blocked-app M |
| F27 | AC-F27.1 | T4.7 A+M timing and no new calls after cancellation; T4.14 additionally no next input action |
| F28 | AC-F28.1–3 | T5.1 controlled local stdio/HTTP fixtures A+M |
| F29 | AC-F29.1–3 | T5.2 fake-model tool selection/validation A, in-app authoring M |
| F30 | AC-F30.1–3 | T1.2 fake plugin tree/migrations A; T6.1 replay .1/.2 against every real flag A+M |
| F31 | AC-F31.1–3 | T1.4 service/keyring fixtures .1/.3 A; T1.14 .2 over WS A; real locked keyring M |
| F32 | AC-F32.1–2 | T1.3 .1 WAL crash A; T6.4 .2 clock-controlled retention A before preview |
| F33 | AC-F33.1–3 | T3.1 .2 and downloader/offline harness A; T3.15 .1/.3 fresh profile A+M |
| F34 | AC-F34.1–2 | T4.5 .1 computed egress A+M; T1.5 .2 A; T5.1 replay table with MCP |
| F35 | AC-F35.1 | T6.3 clean 24.04 VM M; T7.3 repeats on both releases |
| F36 | AC-F36.1 | T6.5 seeded-secret bundle A; T1.5 logs/T3.13 overlay checked separately before preview |
| F37 | AC-F37.1–2 | T1.13 text harness; T3.14 voice harness; T4.15 read-only demo tools A, all network and real mic blocked |
| F38 | AC-F38.1 | T4.16 early .deb smoke, T7.1/T7.3 final clean-install/ordinary-uninstall/confirmed-purge M |
| F39 | AC-F39.1–3 | T1.1 property/reactivity/failure-isolation A |
| F40 | AC-F40.1–3 | T1.6 .1/.3 A; T2.2 .2 A; T3.15/T4.15 reconnect mid-speech/tool replay A |

Additional normative checks: every feature task tests its documented error paths, limits/defaults
and off/on transition, not only its short AC list. T6.7 collects these per-feature checklists and
rejects an unexplained skip. UI checks include keyboard navigation, Escape/focus restoration,
light/dark, reduced motion, DPI, clipping and no persistent diagnostic UI (**X18**, T2.11/T6.6).
F25's table is enumerated row by row, including every byte/depth/time/path bound (**X19**, T4.13).
Untrusted Markdown/links/tool output never execute renderer HTML or trigger shell operations
(**X20**, T2.9/T4.3). T7.3 tests upgrade with config/DB backups, rollback on failed migration and
normal uninstall retaining data (**X21**). T6.7 tests permission loss, network loss, disk full,
keyring lock, device unplug, suspend/resume and unavailable GPU (**X22**).

## 5. Measurement protocol

Use the primary Intel/AMD machine; record exact CPU/GPU/RAM, Ubuntu/GNOME/session, display scaling,
power mode, model revision and lockfile commit. Functional VM checks are separate from hardware
performance. NVIDIA is documented best-effort, not an undisclosed v1 acceptance prerequisite.

- **Idle:** after startup settles, sample process-tree RSS and CPU for 5 minutes, with no local
  models loaded and avatar at scale 1.0/30 fps. CPU is percent of one logical core, not total machine
  percent. Core: <250 MB and <3%; shell+renderer: <5%. Also record shell RAM against 02's shell
  comparison budget. Repeat hidden (0 render frames) and after 20 avatar replacements for leaks.
- **Startup:** 20 fresh process launches with cached config but no loaded models; record all samples,
  p50/p95 and maximum for core-ready ≤1.5 s. Do not call a model warm-up or download part of this
  core-only number. Separately record cold first Talk and cached-model first Talk.
- **Voice:** at least 30 five-second synthetic/licensed utterances through the actual pipeline;
  record per-stage and complete-path timestamps, p50/p95, cold vs warm, network/provider/model,
  and any failure. Verify F10's ≤1 s STT, F12's ≤400 ms ten-word TTS and end-to-end p50 ≤2 s
  independently. Do not add ceilings and call that a measured latency. Live cloud trials require
  consent; offline fake results are not cloud latency evidence.
- **Animation:** record actual presented frames and frame intervals while speaking at scale 1;
  verify sustained 60 fps and <1 ms player updates, including expressions and closure dominance.
  Report drops rather than hiding them in an average. Hidden = no animation frames.
- **Lip sync:** pin 30 synthesis texts, voice/model/speed, PCM fixture hashes and independently
  annotated /p b m/ intervals (human-reviewed audio landmarks, not `pred_dur` compared with itself).
  Assert every closure ≥40 ms at weight ≥0.9 within ±40 ms. Calibrate visual capture/audio offset
  and record a close-up to establish <45 ms mouth/audio offset; insufficient capture precision
  means unverified. Basic VRM must visibly close too; an internal channel value alone is insufficient.
- **Interruptions:** time from speech onset/key press to actual audio silence, not just cancel
  enqueue. Verify F13's ≤350 ms onset-to-silence and F27's ≤300 ms key-to-silence, no later calls,
  and no stale segment after immediate new input. Ten-minute AEC trial uses laptop speakers.

Store text/metrics and generated/licensed fixtures only. Never persist the user's mic audio.
Failed targets remain failed; tuning/config/hardware changes require recording a new comparable
baseline, not retroactively relabeling old evidence.

## 6. Executable sequence and release gates

1. Finish reopened T0.8/T0.10 evidence, then T0.11 and T0.12, then T0.13 foundation review.
2. Phase 1 task DAG → **T1.14** headless integration; Phase 2 → **T2.11** text-desktop integration.
3. Phase 3 → **T3.15** voice integration; then T4.1/T4.2/**T4.0** integrate the tool loop before
   desktop tool handlers. Finish read tools, approvals, Stop, subscription tools and boundaries.
4. Before preview, pull forward **T5.4** (remaining cloud speech adapters), **T6.2** (looks/import),
   **T6.4** (retention/settings export/import), **T6.6** (lifecycle/shortcuts), **T4.15** integration
   and **T4.16** early packaging. Their task IDs stay stable. **T4.10** verifies the complete v0.5
   definition, rather than merely depending on earlier-numbered T4 tasks.
5. Continue act/shell/computer-use tools, MCP/skills/Gemini/offline, all settings/onboarding/errors,
   then Phase 7 packaging/clean-VM/README/measurements. Each task merges to main after checks.
6. Public publication/tagging remains a separate explicit approval. A tested local release candidate
   does not imply permission to distribute the subscription path, spend money or upload user data.
   Development tasks do not depend on a GitHub release being published.

The next implementation task is **closing the current foundation gates**, not starting Phase 1.
If the needed Wayland VM/session or user action is unavailable, record the exact prerequisite and
ask for it. No planning placeholder authorizes bypassing that gate.
