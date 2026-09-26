# 0004 — Use a small reversible plugin kernel
Status: Accepted

Context: Feature toggles, provider replacement, live skills, MCP connections, and future surfaces all
need components to appear and disappear without leaking registrations or restarting the app.
Cordis' spatial and temporal composability semantics fit those requirements, but adopting a large
external harness would add an unstable framework and a second runtime. The design is in
[Architecture §2](../revamp/01-architecture.md#2-spatiotemporal-composability-what-we-take-from-deepseeks-paper).

Decision:
- Implement an in-house Python kernel of roughly 300 lines using contexts, fibers, declared service
  injection, typed events, and reversible effects.
- Track each plugin's effects and dispose them sequentially in LIFO order after disposing dependents.
- Put background work behind `ctx.spawn()` so unmounting cancels it.
- Start with `emit`, `waterfall`, and `serial` dispatch; add modes only when a real use case requires
  them.
- Load built-in Python plugins only. User extensibility remains data or out-of-process through skills,
  persona, and MCP.

Consequences:
- One mount/unmount mechanism implements feature flags, provider swaps, and live reconfiguration.
- Every plugin must register side effects through its context rather than mutate global state.
- The kernel becomes critical infrastructure that requires property-based revertibility and
  dependency-reactivity tests.
- Svara owns and maintains the kernel instead of inheriting a third-party framework's behavior.

Evidence:
- [Feature F39](../revamp/12-feature-specification.md#f39--plugin-kernel-developer-facing) defines the
  observable guarantees.
- T1.1 implements the kernel and randomized lifecycle tests.
