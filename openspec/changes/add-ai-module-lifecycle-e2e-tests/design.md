# Design: Full Lifecycle E2E Tests

## Context
- Existing: AI module create, patch generate, test run, submit-review, review (approve/reject), publish, unpublish; plus (from add-full-system-generation-and-deploy) generate-system and deploy endpoints guarded by `system:generate`.
- Need: One coherent test that runs the full sequence 创建 → 审批 → 生成 → 部署 → 卸载 so that the pipeline is validated end-to-end.

## Goals / Non-Goals
- **Goals**: Define and implement a single runnable flow that (1) creates a module, (2) submits and approves it, (3) calls generate-system, (4) calls deploy, (5) unpublishes (and optionally uninstalls/teardown). Assert at each step. Use admin (or user with `system:generate`) in test so all actions are allowed.
- **Non-Goals**: Real code generation or real deployment; tests may assert on stub responses (jobId, status). No change to production API contracts.

## Decisions
- **Decision**: Prefer **API-level integration test** first (backend or shared test that calls REST endpoints with a seeded admin token). This avoids flaky UI and runs in CI without a browser. UI E2E (e.g. Playwright) can be added later as an optional layer.
- **Decision**: "Uninstall" (卸载) in the test means at least **unpublish** the module. If the system later supports teardown of a deployed artifact, the test MAY add a step for that; for now, unpublish is sufficient.
- **Decision**: Tests use **stub** generate-system and deploy (current implementation returns jobId/status without doing real work). Assertions: create returns 201 and module id; approve transitions status; generate-system returns 200 and jobId; deploy returns 200 and deployId; unpublish returns 200 and status unpublished.
- **Alternative considered**: Full UI E2E only — rejected for first slice because slower and more brittle; API test gives fast feedback. UI can be added in a follow-up.

## Risks / Trade-offs
- **Risk**: Test depends on seeded admin and permissions (`system:generate`). Mitigation: document seed requirement; CI runs seed before lifecycle test.
- **Trade-off**: Stub generate/deploy means we do not verify real codegen or deploy logic; we only verify the pipeline and permissions. Real generator/deploy tests are separate.

## Migration Plan
- Add test file(s) and npm script; no production migration. Optional: add CI job "lifecycle-e2e" that runs after seed.

## Open Questions
- None for minimal scope. Later: add Playwright UI E2E for the same flow?
