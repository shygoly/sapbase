# Change: Clarify New Module Definition and Patch Publish Requirements

## Why
The current `add-new-module-definition-flow` specs leave several critical points ambiguous: where step artifacts are persisted, exact patch scope values, and where the patch publish pipeline is executed. These gaps create implementation drift and make task completion claims hard to verify.

## What Changes
- **MODIFIED**: `ai-module-management` requirements to explicitly require persistence of structured step artifacts (not just transient UI state).
- **MODIFIED**: `ai-module-management` step component requirement to require artifact save semantics and deterministic completion behavior.
- **MODIFIED**: `patch-dsl-system` schema requirement to remove ambiguous scope wording and define one canonical scope set.
- **MODIFIED**: `patch-dsl-system` publish pipeline requirement to align execution responsibilities with current architecture (pipeline runs before schema persistence, publish status update does not imply schema apply has already occurred).
- **TIGHTENED**: Tasks with explicit, testable acceptance criteria and removal of conditional wording (e.g., no “if required”).
- **ADDED**: Design notes documenting responsibility boundaries (backend publish vs patch apply pipeline trigger).

## Impact
- Affected specs: `ai-module-management`, `patch-dsl-system`
- Affected changes for consistency: `add-new-module-definition-flow`
- Implementation impact: none in this proposal (spec/design/task correction only)
