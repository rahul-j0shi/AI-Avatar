# 0001 — Record architecture decisions
Status: Accepted

Context: Svara's plan contains choices that affect several phases, and later spikes can invalidate
some of their assumptions. Those choices need a durable history separate from feature requirements
and implementation details. The ADR index and lifecycle are defined in the
[implementation guide §5](../revamp/13-implementation-guide.md#5-adr-index).

Decision:
- Store architecture decision records in `docs/adr/NNNN-title.md` with monotonically increasing
  numbers.
- Record status, forcing context, the decision, consequences, and supporting evidence.
- Keep accepted ADRs immutable except for clarification. Replace a changed decision with a new ADR
  and mark the old one `Superseded by NNNN`.
- Update an ADR's evidence when its planned spike completes, without rewriting the decision itself.

Consequences:
- Reviewers can distinguish settled architecture from proposals and feature specifications.
- Spikes have an explicit place to record why a proposal was accepted, rejected, or replaced.
- Every material architectural change adds a small documentation obligation.
- ADRs explain decisions; they do not duplicate acceptance criteria or serve as API documentation.

Evidence:
- T0.4 establishes the initial decision set, ADR-0001 through ADR-0016.
- The authoritative product scope remains
  [the feature specification](../revamp/12-feature-specification.md).
