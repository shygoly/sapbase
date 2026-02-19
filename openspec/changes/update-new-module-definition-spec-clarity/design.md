## Context
`add-new-module-definition-flow` introduced valuable direction but left ambiguity in three areas:
1. Structured outputs from the 6-step wizard were not explicitly required to be persisted.
2. Patch scope wording mixed `layout` and `state`, conflicting with runtime `PatchScope`.
3. Publish pipeline semantics implied synchronous apply on publish, while current architecture separates publish status from schema application.

## Goals / Non-Goals
- Goals:
  - Make requirements implementation-safe and testable.
  - Keep canonical patch scope values aligned with runtime.
  - Clarify lifecycle boundaries: publish intent vs schema application.
- Non-Goals:
  - No runtime or API implementation changes in this patch.
  - No new capabilities beyond clarification of existing ones.

## Decisions
- Decision: Persisted artifacts are mandatory for the 6-step flow.
  - On wizard completion, the system SHALL persist a structured definition artifact (e.g., in module metadata or equivalent storage), not only create a named draft module.
- Decision: Canonical scope set is `page | object | permission | state | menu`.
  - `layout` is documentation terminology mapped to `page` semantics; it is not a separate runtime scope.
- Decision: Publish and apply boundaries are explicit.
  - `publish` marks module lifecycle/registry state.
  - Patch pipeline `Validator -> Dry Run -> Apply -> Versioned Save` SHALL execute before any schema persistence and may be triggered by a dedicated apply action/path.

## Risks / Trade-offs
- Risk: Tighter requirements may invalidate “complete” task states from prior change docs.
  - Mitigation: Define explicit acceptance checks in tasks and re-validate strict.
- Risk: Clarifying boundaries without implementation can expose temporary behavior gaps.
  - Mitigation: Keep scope minimal and actionable so apply-stage can close gaps quickly.

## Migration Plan
1. Accept this clarification change.
2. Use apply-stage to update implementation and tests against the tightened requirements.
3. Reconcile previous task completion claims with objective checks.

## Open Questions
- Which persistent storage is preferred for step artifacts (`AIModule.metadata` vs dedicated definition draft entity)?
- Should apply be user-triggered or part of an automated publish orchestrator in future phases?
