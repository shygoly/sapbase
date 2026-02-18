# Change: Add Full Lifecycle E2E Tests (Create, Approve, Generate, Deploy, Uninstall)

## Why
The AI module lifecycle (create → review/approve → generate system → deploy → uninstall) must be **verifiable end-to-end**. Without a single executable flow that runs the full chain, regressions or integration gaps can go unnoticed. Stakeholders need confidence that 创建、审批、生成、部署、卸载 work correctly in sequence and that permissions (e.g. `system:generate`) are enforced.

## What Changes
- **ADDED**: A defined E2E test suite (or test scenario specification) that covers the full lifecycle: (1) create module, (2) submit for review and approve, (3) trigger full system generation, (4) trigger deploy, (5) uninstall/unpublish (and optionally teardown deployed artifact). Each phase SHALL be executable and assertions SHALL be specified.
- **ADDED**: Requirement that the system SHALL provide a way to run this full lifecycle test (e.g. single script, Playwright/Jest flow, or API-only integration test) and that the test SHALL be runnable in a test environment (e.g. with admin user and stub generate/deploy).
- **DOCUMENTED**: Scope of "uninstall" (卸载): at minimum unpublish of the module; if deploy creates a deployed artifact, uninstall MAY include teardown of that artifact when such capability exists.
- **OPTIONAL**: Design decisions for test framework (API-only vs UI E2E), use of stubs for generate/deploy in CI, and sequencing/cleanup so tests are idempotent or isolated.

## Impact
- Affected specs: `ai-module-management` (new requirement for full lifecycle E2E test coverage).
- Affected code: test suite (new or extended E2E/integration tests under backend or speckit; may add npm script or CI step to run the lifecycle test). No production code required unless test infrastructure is missing.

## Out of Scope
- Changing the behavior of create, approve, generate, deploy, or uninstall; only adding tests that verify current (or specified) behavior.
- Implementing real code generation or real deployment; tests MAY use stub endpoints and assert on status/jobId responses.
