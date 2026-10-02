# Implementation-ready planning checkpoint — 2026-10-02

Request: finish the whole plan so developers can pick up from the current standing, before more
feature development. This is a documentation/plan-validation change, not a product feature.

## Delivered

- [Developer handoff](../revamp/15-developer-handoff.md): actual code inventory, setup/check commands,
  first T0.10/T0.8 work package, required environments/consent, module/test map and completion template.
- [Acceptance/integration contract](../revamp/14-acceptance-and-integration.md): all 40 features,
  114 ACs, 22 cross-feature regressions, quantitative measurement procedures, explicit failure gates.
- [Executable backlog](../revamp/13-implementation-guide.md): 89 tasks, explicit acyclic
  dependencies, phase integration tasks and preview pull-forwards instead of premature AC claims.
- Complete playback-credit/progress, management-operation, scoped IPC and file-transfer contracts;
  speech credentials/shortcuts/validation settings; safe hide/mute/pause/approval/reconnect behavior.
- Existing R1–R38 wishlist retained, including character-only desktop UI, complete context menu,
  hide/minimize/restore, CLI/keyboard cold start, volume/mute/pause/Stop/Quit and removal.
- Coqui removed from v1 by explicit user decision; Kokoro, ElevenLabs, Azure and OpenAI TTS remain.
- Version-dependent provider behavior is capability-gated. Subscription isolation, usage provenance
  and distribution permission have separate tests/gates; no implicit paid fallback or login UI.
- Linked roadmap, feature specification, architecture and affected ADRs reconciled. Post-v1 browser
  extension remains separate, with bounded follow-up exits rather than being accidentally built now.

Clarifications, not extra product features: press-to-toggle Talk, hidden mic closed, mutation
serialization, safe context-limit outcome, actual Stop timing vs delayed audit records, Type retained
in the tray as well as avatar menu, and safe portable settings import/export.

## Verification

- `node docs/revamp/check-plan.mjs`: explicit dependency/cycle/reference checks, release reachability,
  all feature ACs assigned, wishlist retained, local Markdown file targets exist.
- `node --check docs/revamp/check-plan.mjs` and `git diff --check`: passed.
- Ruff lint/format, Pyright, Biome and TypeScript: passed.
- Existing Python suites: 10 passed; Vitest: 9 passed; Electron Node validation test file passed.
- Native dependency smoke: all 19 imports and four native checks passed on CPython 3.14.7.
- Desktop production build command passed (still builds the diagnostic spike); existing ~986 KB
  chunk warning remains. No production UX or performance acceptance inferred.
- The historical `/tmp/svara-audit-tools/bin/uv` is gone, so the old `make ... UV=...` command could
  not run. Equivalent Python checks were run using the existing `core/.venv/bin/` executables;
  pnpm/Node checks ran normally. No dependency/lockfile upgrade or host package install was made.
- ONNX Runtime emitted a telemetry-ID persistence warning during the pre-existing smoke test.
  Native-runtime telemetry disable/egress verification is explicitly assigned in 14 X16; no runtime
  privacy compliance is claimed by this plan.
- No GUI/Wayland, microphone, screenshot, account-login or paid provider test was performed in this
  planning turn. Those remain implementation prerequisites, not documentation checks.

## Next work and limits

Resume the exact foundation work package in 15 §4. T0.10 is still partial; T0.8 visible accuracy and
resource/latency gates remain open. T0.11/T0.12 have not started, and T0.13 must pass before Phase 1.
Planning completeness means developers have a concrete task, test and failure decision; it does not
mean every future experiment is guaranteed to succeed. If a gate fails, stop its dependent work and
bring the evidence to the user before changing scope or budgets.

Keep both the existing feature branch and `docs/complete-implementation-plan`. Merge the planning
checkpoint to main after checks, then create the next implementation branch from updated main.
The unrelated untracked `:memory:.ses` is untouched and excluded.
