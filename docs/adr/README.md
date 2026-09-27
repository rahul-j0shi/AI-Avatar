# Architecture Decision Records

Svara records durable architecture choices here using the process in
[ADR-0001](0001-record-architecture-decisions.md). Product behavior remains authoritative in the
[feature specification](../revamp/12-feature-specification.md).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-support-ubuntu-and-use-xwayland.md) | Support Ubuntu and run the avatar window through XWayland | Accepted |
| [0003](0003-separate-python-core-and-web-shell.md) | Separate the Python core from the web desktop shell | Accepted |
| [0004](0004-use-reversible-plugin-kernel.md) | Use a small reversible plugin kernel | Accepted |
| [0005](0005-use-python-314-structured-concurrency.md) | Use standard Python 3.14 with structured concurrency | Accepted |
| [0006](0006-select-desktop-shell-by-measurement.md) | Select Electron as the desktop shell | Accepted |
| [0007](0007-use-vrm-10-avatars.md) | Use VRM 1.0 avatars with a CC0 default | Accepted |
| [0008](0008-build-phoneme-to-viseme-performance-engine.md) | Build a phoneme-to-viseme performance engine | Accepted |
| [0009](0009-use-kokoro-with-thin-onnx-runner.md) | Use Kokoro through a thin ONNX runner | Accepted |
| [0010](0010-capture-audio-in-core-with-pipewire.md) | Capture microphone audio in the core with PipeWire | Accepted |
| [0011](0011-separate-chat-and-agent-model-ports.md) | Separate chat-model and agent-backend ports | Accepted |
| [0012](0012-build-small-agent-loop-and-append-only-history.md) | Build a small agent loop with append-only history | Accepted |
| [0013](0013-enforce-capability-permissions-in-tool-handlers.md) | Enforce capability permissions inside tool handlers | Accepted |
| [0014](0014-use-jsonc-pydantic-and-live-reconfiguration.md) | Use JSONC, pydantic schemas, and live plugin reconfiguration | Accepted |
| [0015](0015-store-events-in-append-only-sqlite.md) | Store events in append-only SQLite | Accepted |
| [0016](0016-distribute-a-deb-without-auto-update.md) | Distribute an Ubuntu deb without automatic updates | Accepted |
