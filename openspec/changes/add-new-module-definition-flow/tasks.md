# Tasks: New Module Definition vs Patch Protocol

## 1. OpenSpec and documentation
- [x] 1.1 Add proposal and spec deltas for new module definition flow
- [x] 1.2 Document patch protocol schema and five patch types in patch-dsl-system
- [x] 1.3 Document publish pipeline (Validator → Dry Run → Apply → Versioned Save)
- [x] 1.4 Add CRM example (relationships, states, permissions)

## 2. New module definition step component
- [x] 2.1 Create 6-step wizard component (object model, relationships, state flow, pages, permissions, reports)
- [x] 2.2 Integrate with develop page (Create New → optional 6-step path)
- [x] 2.3 Persist or pass state per step for submission

## 3. Patch schema alignment
- [x] 3.1 Ensure Patch interface has patchId, timestamp, actor, scope, operation, target, payload
- [x] 3.2 Add scope "layout" to PatchScope if required (or map layout to page)

## 4. Publish pipeline
- [x] 4.1 Document where Validator → Dry Run → Apply → Versioned Save run (frontend vs backend)
- [x] 4.2 Normalize patchContent in backend generate/publish to Patch shape
