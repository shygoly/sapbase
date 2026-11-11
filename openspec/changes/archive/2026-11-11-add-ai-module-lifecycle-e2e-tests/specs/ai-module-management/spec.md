# AI Module Management – Delta: Full Lifecycle E2E Test

## ADDED Requirements

### Requirement: Full Lifecycle E2E Test
The system SHALL provide an executable end-to-end test that covers the full AI module lifecycle: create, approve, generate system, deploy, and uninstall (unpublish).

#### Scenario: Test sequence create through uninstall
- **WHEN** the full lifecycle E2E test runs
- **THEN** the test SHALL create an AI module (e.g. via POST create) and assert success and a valid module id
- **AND** SHALL submit the module for review and then approve it (submit-review, then review with decision approved) and assert status transition
- **AND** SHALL call the generate-system endpoint for the module and assert 200 and a non-empty jobId or status
- **AND** SHALL call the deploy endpoint (e.g. with moduleId or jobId) and assert 200 and a non-empty deployId or status
- **AND** SHALL unpublish the module and assert status is unpublished
- **AND** SHALL use an identity that has permission to perform all actions (e.g. admin or user with `system:generate` and review rights)

#### Scenario: Lifecycle test is runnable in test environment
- **WHEN** the test environment is set up (e.g. database seeded with admin and `system:generate` permission)
- **THEN** the full lifecycle test SHALL be runnable via a single command or script (e.g. npm script or test runner)
- **AND** SHALL not require real code generation or real deployment; it MAY use stub endpoints and assert on status/jobId responses
- **AND** SHALL be documented so that CI or a developer can run it after seed

#### Scenario: Uninstall step means at least unpublish
- **WHEN** the lifecycle test performs the "uninstall" (卸载) step
- **THEN** the test SHALL at least call unpublish on the module and assert the module status is unpublished
- **AND** MAY additionally trigger teardown of a deployed artifact when the system supports such an operation
