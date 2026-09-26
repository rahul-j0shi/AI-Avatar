# 0003 — Separate the Python core from the web desktop shell
Status: Accepted

Context: Svara needs Python's AI, audio, automation, and provider ecosystem together with a
transparent, GPU-rendered web UI. Putting all logic in a desktop framework would couple the agent to
one shell and make the planned browser extension expensive. The process boundary is described in
[Architecture §1](../revamp/01-architecture.md#1-the-big-picture) and
[Architecture §3a](../revamp/01-architecture.md#3a-process-lifecycle-shell--core).

Decision:
- Run one Python core process and one desktop shell process.
- Keep providers, conversation orchestration, policy, configuration, storage, tools, and performance
  generation in the core.
- Keep windows, tray integration, menus, the WebAudio playback clock, rendering, and other
  surface-specific behavior in the shell.
- Connect them over a versioned loopback WebSocket protocol authenticated by a random token created
  for each launch.
- Make the shell own the core sidecar lifecycle and terminate or recover it deterministically.

Consequences:
- The same core can later serve a browser-extension surface.
- A typed protocol, authentication handshake, binary framing, compatibility rules, and generated
  TypeScript types become mandatory.
- Startup, crash recovery, and cancellation span a process boundary and require integration tests.
- The shell must remain thin even when a shell SDK offers a convenient place for business logic.

Evidence:
- [Feature F40](../revamp/12-feature-specification.md#f40--core--surface-protocol-developer-facing)
  defines the contract acceptance criteria.
- T1.6 implements and drift-checks the protocol.
