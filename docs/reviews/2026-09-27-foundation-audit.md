# Foundation audit and implementation checkpoint

Scope: code through **T0.10**, all 13 revamp documents, ADRs/spike reports, and the recorded R1–R38
wishlist. Do not start T0.11 or Phase 1. This is the user's requested correction/review checkpoint.

**Planning follow-up, 2026-10-02:** [14](../revamp/14-acceptance-and-integration.md) and
[15](../revamp/15-developer-handoff.md) now define the per-AC ledger, corrected task DAG and exact
resume package. Coqui was removed from v1 by explicit user choice. The historical planning gaps
below are resolved by that follow-up; the empirical gates and implementation status are unchanged.

## Actual progress

Core packages are scaffolding. There is no assistant core, CLI, tray or settings window yet.
Electron runs a **development measurement page** with a VRM renderer and canned Kokoro playback.
No F01–F40 product feature is accepted as complete. “Covered” in the plan means **specified**, not
implemented. The diagnostic panel is not the requested desktop UX.

| Task | Status | Evidence / remaining gate |
|---|---|---|
| T0.1 reset | Implemented | Prototype preserved at `v0-prototype` |
| T0.2 scaffold / Svara rename | Implemented | Workspaces, identities, LFS attributes |
| T0.3 tooling | Implemented, expanded here | Local checks; remote CI must be verified for this commit |
| T0.4 ADRs | Written | Accepted architecture does not mean implemented behavior |
| T0.5 Tauri | Historical X11 evidence | Absolute performance gate failed; not Wayland coverage |
| T0.6 Electron | Historical X11 evidence | CPU/RAM/frame budgets unresolved; not Wayland coverage |
| T0.7 shell choice | Accepted decision | Electron selected by fallback rule; no budget waiver |
| T0.8 Kokoro | Partial; accuracy gate reopened | Duration extraction valid; visible onset claim withdrawn; corrected build needs visual rerun |
| T0.9 dependencies | Recorded package/native smoke pass on 24.04/26.04 | Container is not desktop validation; load time is not speech latency |
| T0.10 integration | Partial, open | [Detailed evidence and fallbacks](../spikes/T0.10-ubuntu-integration.md) |
| T0.11/T0.12 | Not started | Subscription bridge / licensed production avatar |

## Corrections in this pass

| Finding | Fix and evidence |
|---|---|
| Closure test proved a peak, not a held closure | >=40 ms PP/FF plateaus; assert plateau endpoints |
| Same-viseme overlapping ramps inserted zeros | Union channel curves; overlap regression |
| Arithmetic attack adjustment called visible accuracy | Rename metric; correct T0.8 and ADR-0009; <45 ms gate stays open |
| Playback overlap, stale decode/completion, leaked contexts | Single owner, cancellation and cleanup; playback regression tests |
| Audio/face used separate clock origins | Sample the active AudioContext; clock test |
| Ended performance could resume sine mouth motion | Return renderer to idle at track boundary |
| VRM ignored envelope; fallback jaw ignored closure | Envelope scales retarget weights; closure suppresses jaw |
| VRM replacement/unmount resource leaks and stale loads | Generation guard, deep disposal, idempotent teardown; visual/memory rerun still needed |
| Drag initialization outlived pointer release | Identity/pointer guards, capture-loss handling, >4 px threshold |
| Focus experiment became default without passing | Managed baseline restored; explicit experiment flag only |
| IPC coercion / unrestricted URL / LAN preview | Numeric validation, loopback-only URL/binding, navigation denial; Node tests |
| Main checks skipped Kokoro and Electron CJS | Include spike tests/lint and CJS; CI builds desktop |
| MIT metadata contradicted Apache repository | Correct root JS/Python metadata; repository license unchanged |
| Whisper profile used moving revision | Pin cached observed revision `536b0662742c02347bc0e980a01041f333bce120` |
| Capability probe could hang/crash | Timeout and unavailable results; regression tests |
| AEC timeout mislabeled success | Explicit mic opt-in, unique temporary node, byte counting; transport-only label |
| Shortcut mutation/timing unreliable | Remove automatic mutation script; consent-based manual checklist |
| Plan contradicted authoritative spec | Reconcile append-only interruption, XDG paths, no mic recording, VAD bundling, system espeak, permission modes, global shortcuts, SSE deferral |

## User's desktop checklist — retained, not done

Every row is still **not implemented as a product feature**.

| Requirement | Contract / tasks |
|---|---|
| Only avatar idle; no dialog/terminal/stats/persistent controls | F02 AC7; T2.3 production bundle + screenshot/DOM audit |
| Complete right-click controls | F03; T2.7 native menu and checked state |
| Configure and Conversations on demand, separate windows | F07/F08; T2.9/T2.10/T6.1 |
| Bottom-right, drag anywhere, preserve/clamp across monitors/restart | F02; T2.3/T6.6 |
| Minimise/hide indefinitely or 30 minutes; hidden = 0 fps | F02/F03; T2.3/T2.7 |
| Tray/keyboard/terminal restore; off-screen recovery | F01–F03; T2.1/T2.3/T2.7/T6.6 |
| Keyboard/terminal cold start and single-instance forwarding | F01 AC6–7; T2.1 |
| Stop work distinct from hide and quit | F27; T4.7 cancellation, audio silence, no later tool calls |
| Independent mic mute, voice pause and output volume/mute | F03/F09/F11/F12; T2.7/T3.2/T3.10 |
| Avatar size and all-workspaces controls | F02/F03; T2.3/T2.7 |
| Disable autostart; Quit leaves no process | F01; T2.1/T6.6 |
| Remove package; separately confirm purge of user data/integrations | F38; T7.1/T7.3 |
| Double-click Talk; inline Type; current-exchange bubble | F05/F06/F09; T2.8/T3.3 |
| Configure/toggle each feature/provider/tool live | F08/F30/F39; T1.1/T1.2 and each plugin/UI task |

## Full feature inventory and implementation ownership

All rows are **planned, not accepted**. Add concrete test IDs as ACs land. A merged task or spike
does not automatically satisfy these product tests.

| Feature | Tasks / acceptance evidence required |
|---|---|
| F01 lifecycle | T2.1/T6.6: single instance, cold/warm actions, crash/restart, shutdown, autostart |
| F02 floating avatar | T2.3/T6.6: avatar-only, drag/shape/focus/scaling, hide/restore, frame budgets |
| F03 menu/tray | T2.7/T3.10: exhaustive actions, persistence, recovery matrix |
| F04 states | T1.12/T2.6/T3.3: transitions, mic indication, <=100 ms visuals |
| F05 bubble | T2.8/T3.10: clean current exchange, speech timing, truncation/hide |
| F06 typing | T2.8: focus, multiline/limits, Escape, interruption/approval rules |
| F07 conversations | T2.9: paged list/transcript, search/export/delete/new |
| F08 Configure | T2.10/T4.3/T4.5/T5.1/T5.2/T6.1: all sections, live edits, stale-write rejection |
| F09 mic/VAD | T3.2/T3.3/T6.6: no idle mic, mute/preroll/limits/hotkey |
| F10 STT | T3.4/T5.4: adapter contracts, noise filter, live swap, latency |
| F11 response modes | T3.10: all modes, pause distinct from volume |
| F12 TTS/playback | T3.5/T3.6/T3.8/T3.10/T5.4: normalization, bounded synthesis, gaps/volume/latency |
| F13 barge-in | T3.11: speaker self-interruption, stop latency, append-only history |
| F14 avatar/looks | T0.12/T2.4/T6.2: licensed asset, live editor/import/license rules |
| F15 lip sync | T3.7/T3.8: 30-sentence closures, measured <45 ms offset, fallback |
| F16 expressions/gestures | T3.5/T3.9: strip tags, cue timing, closure dominance |
| F17 idle | T2.5: blink distribution, bounded gaze, CPU gate |
| F18 lab | T3.12: timeline, scrub/slow/A-B, golden export/reload |
| F19 providers | T0.11/T1.8–T1.11/T4.8/T5.3: contracts, subscription isolation/tools, live swap |
| F20 agent | T1.12/T4.1: cancel/timeout/step cap, parallel result grouping |
| F21 context | T1.12/T4.9: boundaries, 300-turn budget, unchanged Anthropic history |
| F22 persona | T1.7/T2.10: reload, language override, editor |
| F23 registry | T4.1: cleanup, filtered tool list, tool/output caps |
| F24 permissions | T4.2/T4.3: >=100 cases, deny precedence, approvals/timeout/audit |
| F25 tools | T4.4–T4.6/T4.11–T4.13: every documented limit + demo |
| F26 computer use | T4.14: grant/action/time bounds, blocked apps, Stop |
| F27 kill switch | T4.7: <=300 ms stop and no subsequent call |
| F28 MCP | T5.1: contracts, unmount/process cleanup, secrets, prerequisites/errors |
| F29 skills | T5.2: create/edit/import, limits/trust, next-turn registration |
| F30 config | T1.2/T2.10: JSONC/schema/migration/live reload/conflict tests |
| F31 secrets | T1.4/T1.6: no plaintext or response leaks; locked keyring |
| F32 storage | T1.3/T6.4: WAL crash, retention, secret/audio-free exports |
| F33 downloads | T3.1: pins/hashes, tamper/offline/resume/remove/import |
| F34 privacy | T1.5/T4.5/T5.1: redaction, screenshot consent, live egress table |
| F35 onboarding | T6.3: clean machine spoken exchange, optional external Claude login |
| F36 diagnostics | T1.5/T3.13/T6.5: timings/rotation, secret-free bundle |
| F37 demo | T1.13/T3.14: full scripted turns without keys/network/mic |
| F38 distribution | T4.10/T7.1–T7.3: .deb, both clean VMs, ordinary uninstall vs confirmed purge |
| F39 kernel | T1.1: property-based reversibility/reactivity/failure isolation |
| F40 protocol | T1.6/T2.2: auth/origin/limits, reconnect/snapshot, audio/schema drift |

R1–R38 remain in [11's wishlist map](../revamp/11-review-and-traceability.md); this inventory adds
implementation ownership. Extension, inventory/publishing, wake word, memory and other platforms
remain explicitly post-v1, not removed.

## Remaining gates and sequencing

- Phase 0 has not exited. T0.8/T0.10 validation is open; T0.11/T0.12 have not started.
- v0.5 requires some ACs currently assigned later: all speech adapters, looks editor/import,
  retention. Pull those existing task scopes forward before T4.10; do not weaken its checklist.
- Document 05's provider/policy assumptions require fresh primary-source verification at T0.11/T1.9.
  This audit made no paid provider call and did not verify subscription billing.
- Optional Coqui is specified but absent from the verified dependency baseline. Its package/runtime
  strategy must be reconciled with the no-PyTorch default before T5.4; no new dependency or silent
  removal of that feature is authorized by this audit.
- Resolve native idle-focus/typing with actual Wayland input tests; a GNOME extension or altered
  user-facing UX requires a new design decision.
- No renderer CPU/RAM improvement or acoustic AEC quality is claimed by this correction pass.
- Corrected playback was rerun locally (below), but visible onset and phoneme accuracy still need
  measurement. Earlier 26.04 container evidence is not a rerun of this commit. Full product E2E
  cannot run before the runtime exists.

Next allowed work is closing these audit/platform gates, **not starting the next feature**.
Keep the working branch. Checkpoint merges do not turn unchecked gates into completed tasks.

## Verification of the corrected build

- `make setup UV=/tmp/svara-audit-tools/bin/uv`: locked Python and pnpm installation passed.
- `make lint test smoke-deps UV=/tmp/svara-audit-tools/bin/uv`: passed. Ruff, expanded Python type
  checks (including spikes), Biome/CJS and TypeScript; 10 Python + 9 Vitest + 4 Node tests. All 19
  runtime imports and four native calls passed on local standard CPython 3.14.7.
- Desktop build and shell-script syntax checks passed. The ~986 KB renderer chunk warning remains;
  it is not a resource-budget pass.
- Real pinned Kokoro + espeak runner reran all five sentences: same duration/frame and coarse-onset
  results, corrected sparse tracks (first sample 84 keys). Temporary espeak executable extracted
  under `/tmp`; no system package installed. Inference remained about 1.6–2.3 seconds.
- Real Electron/X11 integration using loopback DevTools: test VRM loaded; invalid position rejected;
  repeated generated-audio playback, explicit cancellation and natural completion returned idle;
  no renderer runtime exception. Captured screenshot inspected; it is still a diagnostic harness.
  Test Electron/preview processes were stopped afterward. This is not a visual timing measurement.
- Mic probe without opt-in refused with exit 2; no new microphone capture or GNOME shortcut write
  performed during this review pass.
- Latest read-only host probe reported Ubuntu **24.04.5**, GNOME 46, X11. Unlike the earlier
  investigation, all four portal-specific introspections returned no interface members. This is
  recorded as unavailable now, not a pass based on prior version results. Settings/service repair
  and portal interactions were not performed implicitly.
- Prior T0.9 remote CI was verified successful:
  [run 36294807785](https://github.com/rahul-j0shi/svara/actions/runs/36294807785).
  This checkpoint's remote CI must pass before merging; do not infer it from that earlier run.

An unrelated untracked `:memory:.ses` file was left untouched and is excluded from commits.
