# Tasks: Clarify New Module Definition and Patch Publish Requirements

## 1. Spec corrections (ai-module-management)
- [x] 1.1 Modify `New Module Definition Flow (6 Steps)` to require persistence of structured artifacts on completion.
- [x] 1.2 Modify `New Module Definition Step Component` to require deterministic save behavior and explicit completion contract.
- [x] 1.3 Add at least one scenario that fails if artifacts are not persisted.

## 2. Spec corrections (patch-dsl-system)
- [x] 2.1 Modify `Patch Protocol Schema` to define canonical scope set as exactly: `page | object | permission | state | menu`.
- [x] 2.2 Remove ambiguous wording (`layout`, `menu or state`) and document `layout` terminology mapping to `page`.
- [x] 2.3 Modify `Publish Pipeline for Patches` to state that pipeline runs before schema persistence and may be triggered via dedicated apply path.

## 3. Cross-change consistency
- [x] 3.1 Ensure wording in this change is consistent with `add-new-module-definition-flow` README/proposal terminology.
- [x] 3.2 Ensure no task includes conditional acceptance (e.g., “if required”).

## 4. Validation
- [x] 4.1 Run `openspec validate update-new-module-definition-spec-clarity --strict`.
- [x] 4.2 Resolve all validation issues before sharing.
