# Svara

Svara is being rebuilt as an Ubuntu-native, voice-first desktop assistant with an animated 3D avatar.
Its name comes from **svara** (स्वर): voice, tone, musical note, and vowel—the same unit at the heart
of its speech and lip-sync pipeline.

The implementation plan is in [`docs/revamp/`](docs/revamp/README.md). The authoritative v1 scope is
[`docs/revamp/12-feature-specification.md`](docs/revamp/12-feature-specification.md), and the ordered
implementation backlog is [`docs/revamp/13-implementation-guide.md`](docs/revamp/13-implementation-guide.md).

Implementation is currently in Phase 0. The previous browser-based proof of concept is preserved in
the `v0-prototype` Git tag.

## Development bootstrap

The repository uses Node 24 with pnpm 12 and uv-managed Python 3.14. Until T0.3 adds the unified root
commands, bootstrap the two workspaces directly:

```bash
uv sync --project core
corepack pnpm install
```

VRM and VRMA assets are tracked with Git LFS. Install Git LFS before adding or checking out model
assets; the first production avatar is intentionally deferred to T0.12.
