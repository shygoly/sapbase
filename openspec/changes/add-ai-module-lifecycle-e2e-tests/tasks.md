# Tasks: Full Lifecycle E2E Tests

1. **Spec and scope**
   - [x] 1.1 Confirm spec delta in `specs/ai-module-management/spec.md` (ADDED requirement for full lifecycle E2E test).
   - [x] 1.2 Document test sequence: create → submit-review → review (approve) → generate-system → deploy → unpublish; and expected assertions per step.

2. **Test implementation**
   - [x] 2.1 Add API-level integration test (e.g. in backend or shared test dir) that runs the full lifecycle with an authenticated admin user (or user with `system:generate`).
   - [x] 2.2 Test creates a module (POST create), optionally generates patch or uses minimal patchContent.
   - [x] 2.3 Test submits for review (POST submit-review), then approves (POST review with decision approved).
   - [x] 2.4 Test calls generate-system (POST :id/generate-system), asserts 200 and jobId/status.
   - [x] 2.5 Test calls deploy (POST /api/system/deploy with moduleId or jobId), asserts 200 and deployId/status.
   - [x] 2.6 Test unpublishes (POST :id/unpublish), asserts 200 and status unpublished.
   - [x] 2.7 Ensure test is isolated (e.g. create fresh module per run) or cleanup so runs are idempotent.

3. **CI and docs**
   - [x] 3.1 Add npm script (e.g. `test:lifecycle-e2e` or `test:e2e:lifecycle`) that runs the lifecycle test; document dependency on seeded DB with admin and `system:generate`.
   - [x] 3.2 Optional: add CI job to run lifecycle test after seed (or document manual run).

4. **Validation**
   - [x] 4.1 Run the full lifecycle test locally and fix any failures.
   - [x] 4.2 Run `openspec validate add-ai-module-lifecycle-e2e-tests --strict` and resolve issues.
