# 15 — Developer handoff: start from the current repository

Read this first when resuming development. This is a **planning-only** checkpoint; it does not add
a production runtime or mark any feature accepted. The code baseline audited before this plan is
commit `79fc6b1`; the current planning commit builds on it. Use current `main`, not that old commit,
when creating the next branch. Keep all earlier task branches.

## 1. What actually exists

| Area | Current state | How to treat it |
|---|---|---|
| `core/src/svara_core/` | Package directories and `__init__.py` scaffolding | Implement the runtime in Phase 1; do not assume services/CLI exist |
| `packages/avatar/src/` | Spike renderer, metrics, pure performance player and tests | Reuse reviewed pure logic; separate benchmark controls and production API in T2.4/T3.8 |
| `apps/desktop/src/spike-app.tsx`, `spike-playback.ts` | Diagnostic page and canned audio owner | Development-only. Production entry point is a new T2.3 deliverable |
| `apps/desktop/electron/` | Electron probe, preload, validation, tests | Reference for native experiments; T2.1 owns production lifecycle/security bridge |
| `packages/protocol/` | Workspace placeholder | T1.2/T1.6 add schemas/generation, not hand-maintained duplicate TS models |
| `spikes/kokoro/` | Pinned ONNX runner, five fixtures, closure/timing tests | Duration extraction works; visible timing and speed gates are still open |
| `spikes/ubuntu-integration/` | Read-only capability probe, opt-in mic transport check | Neither proves Wayland interaction or acoustic AEC |
| `docs/spikes/`, `docs/adr/`, foundation audit | Evidence and accepted design decisions | An accepted ADR is not a passed feature test |

There is no working `svara` product command, tray, Configure window, agent loop or real voice
conversation yet. `make dev` and `make demo` intentionally fail with explanations; `make gen` is a
placeholder until T1.2/T1.6. Never present the diagnostic page as the requested desktop UI.

An unrelated untracked `:memory:.ses` may exist; leave it untouched and out of task commits.

## 2. Read order and source of truth

1. [Foundation audit](../reviews/2026-09-27-foundation-audit.md): completed work and reopened gates.
2. [12](12-feature-specification.md): normative F01–F40 scope, limits and defaults.
3. [14](14-acceptance-and-integration.md): acceptance owners, cross-feature semantics and gates.
4. [13](13-implementation-guide.md): exact dependency graph, toolchain, config and wire contracts.
5. Only the design sections/ADRs named by the chosen task. [11](11-review-and-traceability.md)
   preserves the full R1–R38 wishlist; [10](10-next-browser-extension.md) is explicitly post-v1.

If an implementation uncovers a contradiction, update 12 first and its dependent design/task docs
in the same PR. Do not silently add scope, lower a numerical target or label a blocked check passed.

## 3. Reproduce the baseline

Prerequisites: Node 24, Corepack/pnpm 12, uv with standard Python 3.14, Git LFS. Use the committed
lockfiles. `espeak-ng` is needed for real Kokoro synthesis, not for every unit test. Installation of
host packages, downloads, mic capture and paid/provider tests require the appropriate consent.

```bash
git status --short
git fetch origin main
git switch main
git merge --ff-only origin/main
git switch -c fix/T0.10-foundation-gates
make setup
make lint test smoke-deps
corepack pnpm --filter @svara/desktop build
git diff --check
node docs/revamp/check-plan.mjs
```

Stop if `main` has diverged or overlapping user edits exist; do not reset them. If the branch name
already exists, inspect and resume it rather than overwriting it. An alternate uv executable can be
passed as `make ... UV=/absolute/path/to/uv`; historical `/tmp` paths are not prerequisites.

Latest audited local baseline: 10 Python, 9 Vitest, 4 Node tests and 19 runtime import/four native
smoke checks. Those counts are a baseline, not a fixed target to preserve. Re-run and record results.

## 4. First actionable work package — finish the current step

**Scope:** T0.10 audit closure, plus the explicitly reopened T0.8 visual/speed check. Do not start
T1.1, build the final UI, install a GNOME extension or swap the selected shell.

**Read:** `docs/spikes/T0.10-ubuntu-integration.md`, `spikes/ubuntu-integration/README.md`,
`docs/spikes/T0.8-kokoro-lipsync.md`,
ADRs 0002/0006/0009/0010, 02 §1–3 and 14 §2/§5.

**Inputs needed:** primary Ubuntu 24.04 Wayland session, 26.04 GNOME Wayland VM/session, a second
ordinary Wayland application for click/focus tests, speaker/mic access only with consent. An X11
session or container does not meet these inputs. Ask the user to make unavailable sessions available;
do not bypass this prerequisite or change their login/session remotely without approval.

**Ordered checklist:**

1. Run `uv run --project core python spikes/ubuntu-integration/capability_probe.py`; record OS,
   session and missing capabilities. No state changes from this check.
2. Reproduce the managed Electron probe using the spike README command. Verify corrected drag,
   stale-playback cancellation and renderer teardown before new native changes.
3. Implement a narrowly scoped focus experiment: managed input hints first, anchored transient
   interaction window second. Exercise idle clicks/drag, Type, Escape, approval controls,
   click-through and above/workspace behavior as one matrix on both releases. Leave failed
   alternatives in evidence, not enabled by default. If both fail, stop with measured alternatives.
4. Complete portal/clipboard/AT-SPI/scaling/shortcut checks with restored test state. Distinguish
   transport/grants from product CLI behavior, whose final owners are T2.1/T3.15/T6.6.
5. Repeat five-sentence Kokoro playback on the corrected player; measure visual timing, not just
   envelope arithmetic. Record TTS inference times and idle resource baseline. Never claim Phase 3
   accuracy/speed acceptance from this small spike.
6. Update spike evidence and affected ADRs, run baseline checks, and produce a PASS/FAIL/BLOCKED
   table for each G-PRESENCE/G-PLATFORM/G-AEC-transport/G-TIMING/G-BUDGET item. Log exact missing
   prerequisites; no catch-all "works locally".
7. Commit/push the retained branch and merge to main after checks. Only then choose T0.11; it needs
   separate consent for account/provider tests. T0.12 follows, then T0.13 reviews foundation exit.

**Exit artifact:** corrected probe + regression tests as needed, reproducible evidence on both
Wayland releases, ADR decision and remaining product-level measurements explicitly assigned. A
partial checkpoint can be merged but must retain blocked status; it does not authorize Phase 1.

## 5. Implementation locations and test ownership

Paths below are target locations; many modules do not exist yet. Create only what the selected
task needs. No external framework or production dependency beyond 13 without a documented reason.

| Task family | Production target | Required test boundary |
|---|---|---|
| T1.1 | `core/src/svara_core/kernel/` | `core/tests/unit/`: Hypothesis mount/unmount/reactivity, no leaked tasks/listeners |
| T1.2/T1.4/T1.5 | `config/`, new `secrets/` and `logging/` under `svara_core` | JSONC fixtures, fake keyring, seeded redaction; no real keys |
| T1.3 | `storage/` | temporary SQLite DB, migrations/WAL crash and event projections |
| T1.6 | `protocol/`, `packages/protocol/src/` generated | schema round trips/drift, malformed/auth/role/asset/transfer fixtures |
| T1.7 | `persona/`, prompt assembly in `agent/` | deterministic prompt/language fixtures |
| T1.8–T1.11/T5.3 | `providers/llm/` | shared `core/tests/contract/` plus separate AgentBackend suite |
| T1.12/T4.0 | `agent/`, `pipeline/` | fake-provider event ordering, complete tool groups, fencing, limits/context |
| T1.13/T2.1 | new core CLI module and `apps/desktop/electron/` | CLI parsing/cold/warm actions, sidecar process tree, strict IPC sender/args |
| T2.2 | `apps/desktop/src/` client/store | client reconnect and snapshot, narrow preload bridge mocks |
| T2.3/T2.7/T2.8 | desktop production entry, avatar window, menus/bubble/type | Vitest logic plus Wayland screenshot/input/focus matrix |
| T2.4/T2.5/T2.6/T3.8/T3.9 | `packages/avatar/src/` | pure renderer/player/retarget goldens; no React/Electron imports |
| T2.9/T2.10/T6.1 | desktop Conversations/Configure modules | paging/search/safe Markdown, JSONC/schema/stale-write UI fixtures |
| T3.1 | new `models/` under `svara_core`, manifest under assets | fake HTTP resume/hash/size/offline and temporary cache |
| T3.2/T3.3/T3.5/T3.10/T3.11 | `pipeline/`, new `audio/` | synthetic PCM/clock tests, opt-in real capture/AEC and no idle mic |
| T3.4/T3.6/T5.4 | `providers/stt/`, `providers/tts/` | recorded/synthetic STT/TTS contracts, missing-key/pending states |
| T3.7/T3.12 | `performance/`, desktop lab | independently annotated tracks, timeline/export→golden and visual calibration |
| T3.13/T6.5 | logging/metrics + desktop Advanced | timestamp accounting and redacted diagnostic archive |
| T3.14/T4.15 | fake adapters + integration fixtures | zero network/real mic; read tools only against bundled sample tree |
| T4.1–T4.8/T4.11–T4.14 | `tools/`, `tools/desktop/`, permission service | table-driven policy, synthetic filesystem/portal, explicit GUI consent |
| T4.9/T6.4 | `storage/`, config import/export | fake clock/retention and bounded hostile archive fixtures |
| T5.1/T5.2 | `mcp/`, `skills/` | local fixture subprocess/server; disconnect/unmount and import trust |
| T6.2/T6.3/T6.6/T6.7 | Configure/first-run + shell integration | license metadata, keyboard/monitor matrix, fresh-profile onboarding/errors |
| T4.16/T7.1–T7.3 | new packaging files/scripts | built-on-24.04 artifact, both clean VMs, upgrade and uninstall/purge |
| T7.4–T7.7 | README, notices, release workflow | published claims trace to actual measured artifacts, approval before release |

Phase integration tasks T1.14/T2.11/T3.15/T4.15 are real work items, not another feature subsystem.
They compose the modules, test the cross-feature cases in 14, and update the acceptance ledger.

## 6. Per-task pickup / completion template

Before coding, put this in the branch's PR or checkpoint note (local notes are sufficient if no PR):

```text
Task ID / title:
Base main commit:
Dependency commits and phase gate evidence:
Scope: Fxx / AC-Fxx.n / Xnn:
Read: design sections and ADRs:
Touch: target modules only:
Tests: automated commands + manual steps and required environment:
External prerequisites / permissions:
Out of scope:

Result: implemented / partial / blocked (not inferred from merge)
Verification: command, commit, environment, expected/actual, artifact:
Remaining failures / exact next action:
Branch/main commit after merge (retain branch):
```

Every normative Behavior/Limit/Error promise touched gets a test/check, including negative paths.
One task at a time; local end-to-end evidence when the runtime exists, fake contracts before then.
`make lint test`, desktop build, schema drift checks when implemented, and `git diff --check` are
the common merge floor. Run relevant integration tests explicitly until they join the root target.
CI supplements local verification; it cannot replace Wayland, acoustic, license or policy evidence.
For planning edits, run `node docs/revamp/check-plan.mjs`: it checks task dependency cycles/unknown
references, all 114 AC assignments, R1–R38 retention and local Markdown file links. It is read-only
and intentionally does not certify behavioral correctness or mark any task complete.
