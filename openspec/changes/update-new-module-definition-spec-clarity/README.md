# Clarify New Module Definition and Patch Publish Requirements

Spec/design clarification for **add-new-module-definition-flow**. No implementation code in this change.

## Summary
- **ai-module-management**: 6-step flow and step component now explicitly require persistence of definition artifacts and deterministic save/finish behavior.
- **patch-dsl-system**: Canonical scope set is `page | object | permission | state | menu`; layout maps to page. Publish pipeline runs before schema persistence; publish status does not imply schema applied.

## Relationship
- Refines requirements in `add-new-module-definition-flow`; implementation updates to satisfy these clarifications are done in a separate apply (e.g. persist wizard artifacts into `AIModule.metadata` or equivalent).
