# 0012 — Build a small agent loop with append-only history
Status: Accepted

Context: Svara needs streaming tool calls and awaitable human approvals, but not durable graph
workflows or long-running background plans in v1. Provider messages, including thinking and tool
blocks, must remain structurally valid when sent back on later turns. The loop is specified in
[Agent §1](../revamp/06-agent-tools-permissions.md#1-agent-loop-no-langgraph) and provider history
rules in [Models §2a](../revamp/05-models-and-accounts.md#2a-anthropic-api-adapter-rules-that-must-hold).

Decision:
- Implement a small asyncio streaming tool-calling loop rather than adopting LangGraph.
- Await approvals directly in tool execution and run independent calls concurrently with a
  `TaskGroup`.
- Append provider messages without editing content that has already been sent.
- Return every result from one tool-call step in one corresponding result message, preserving
  failures as typed error results.
- Store events append-only and derive model history as a bounded projection for each conversation.
- Let an `AgentBackend` own its loop while still emitting normalized Svara events.

Consequences:
- The runtime remains understandable, cancellable, and small.
- Human-in-the-loop approval does not require a graph DSL or checkpointer.
- Persistent background planning and resumable arbitrary workflows remain post-v1 capabilities.
- Adapter contract tests must catch history mutation and provider-specific message-shape errors.

Evidence:
- [Features F20 and F21](../revamp/12-feature-specification.md#f20--agent-turn--loop) define turn and
  context acceptance criteria.
- T1.12 implements the loop, context strategy, retries, and fake-provider tests.
