# Svara

Svara is being rebuilt as an Ubuntu-native, voice-first desktop assistant with an animated 3D avatar.
Its name comes from **svara** (स्वर): voice, tone, musical note, and vowel—the same unit at the heart
of its speech and lip-sync pipeline.

The implementation plan is in [`docs/revamp/`](docs/revamp/README.md). The authoritative v1 scope is
[`docs/revamp/12-feature-specification.md`](docs/revamp/12-feature-specification.md), and the ordered
implementation backlog is [`docs/revamp/13-implementation-guide.md`](docs/revamp/13-implementation-guide.md).
Developers should start with the [current-state handoff](docs/revamp/15-developer-handoff.md) and
[acceptance/integration ledger](docs/revamp/14-acceptance-and-integration.md).

Implementation is currently in Phase 0. The previous browser-based proof of concept is preserved in
the `v0-prototype` Git tag. ADR-0006 selected Electron as the Ubuntu desktop shell after the measured
Tauri/Electron comparison.

Development resumes with the remaining T0.10/T0.8 gates from the
[foundation audit](docs/reviews/2026-09-27-foundation-audit.md), not the next product feature.
It distinguishes implemented foundations, planned features and open gates. The only runnable desktop
build today is a diagnostic spike—not the avatar-only product UI.

## Development

The repository uses Node 24 with pnpm 12, uv-managed Python 3.14, and GNU Make. Install `uv`, then
bootstrap the locked Python and TypeScript workspaces:

```bash
make setup
```

Use `make lint`, `make test`, and `make gen` for the same checks run by CI. The `dev` and `demo`
targets become runnable after their corresponding core and desktop tasks are implemented.

VRM and VRMA assets are tracked with Git LFS. Install Git LFS before adding or checking out model
assets; the first production avatar is intentionally deferred to T0.12.
