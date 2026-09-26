# 0013 — Enforce capability permissions inside tool handlers
Status: Accepted

Context: Svara exposes filesystem, desktop, shell, MCP, and experimental input tools to models that
must be treated as untrusted. Provider-level permission callbacks are inconsistent and can be
bypassed by adapter behavior, so the authoritative check must be at the execution boundary. The rule
model is specified in [Agent §3](../revamp/06-agent-tools-permissions.md#3-permission-engine).

Decision:
- Give every tool a capability, effect class, and optional normalized resource extractor.
- Evaluate compiled JSONC rules deny-first, then ask, then allow, and finally the selected mode.
- Default to `read-only`; even trusted mode asks for execution and input control.
- Normalize paths, resolve symlinks and parent traversal, match command argv without a shell, and
  require every resource of a multi-resource operation to pass.
- Enforce the result inside every tool handler, regardless of model provider or SDK callbacks.
- Record every decision and approval in the event log and time out unanswered prompts as denial.

Consequences:
- One policy applies equally to built-in, MCP, and Agent SDK tool paths.
- Denied tools can be removed from the model-visible schema, reducing both risk and token use.
- The engine is policy and audit, not an OS sandbox; same-user compromise and check-then-use races
  remain outside its guarantees.
- Precise normalization, precedence, approval, and redaction tests are security-critical.

Evidence:
- [Feature F24](../revamp/12-feature-specification.md#f24--permissions-approvals--audit) defines the
  required behavior and adversarial acceptance cases.
- T4.2–T4.4 implement evaluation, approval UI, local rules, and audit views.
