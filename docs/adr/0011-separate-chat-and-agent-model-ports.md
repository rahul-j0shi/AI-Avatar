# 0011 — Separate chat-model and agent-backend ports
Status: Accepted

Context: Most providers stream text and tool calls while Svara owns the agent loop. The Claude Agent
SDK instead owns its loop and exposes the app's tools to an official Claude Code session. Pretending
these are one interface would either leak provider semantics or duplicate orchestration. The two
contracts are defined in [Models §1](../revamp/05-models-and-accounts.md#1-two-ports-not-one).

Decision:
- Define `ChatModel` for normalized messages, streaming deltas, and tool-call events consumed by
  Svara's agent loop.
- Define `AgentBackend` for providers that own the loop but use Svara's prompt, tools, permissions,
  and event stream.
- Implement Claude subscription access as an `AgentBackend` through the official Agent SDK, pointing
  at the user's own installed and authenticated `claude` command.
- Prefer the subscription adapter when a valid login is detected, with API-key and other providers
  available through adapters.
- Disable Claude Code built-ins and settings sources; enforce permissions inside every Svara tool
  handler.

Consequences:
- Provider-specific loop ownership is explicit and testable.
- Two related contract suites are required instead of one over-generalized abstraction.
- Subscription access depends on upstream policy and official login state, so failure leaves the
  plugin pending and preserves the API-key path.
- The app has no user account; provider authentication never becomes Svara identity.

Evidence:
- T0.11 verifies login isolation, streaming, tool exposure, and the subscription gate.
- T1.8–T1.11 implement the ports and their first adapters.
