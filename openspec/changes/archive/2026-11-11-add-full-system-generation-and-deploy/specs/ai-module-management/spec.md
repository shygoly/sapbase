# AI Module Management – Delta: Full System Generation and Deploy

## ADDED Requirements

### Requirement: Full system code generation
The system SHALL support generating deployable frontend and backend source code from an AI module (or its definition).

#### Scenario: Trigger full system generation
- **WHEN** a user with permission `system:generate` requests full system generation for an AI module
- **THEN** the system SHALL accept the request via a dedicated API (e.g. POST generate-system)
- **AND** SHALL require permission `system:generate`; otherwise SHALL return 403
- **AND** SHALL return a job identifier and status (e.g. queued, running, completed, failed)
- **AND** when generation completes, SHALL provide access to the generated artifact (e.g. download URL or path) as defined by the implementation

#### Scenario: Non-privileged user cannot generate system
- **WHEN** a user without `system:generate` calls the generate-system API
- **THEN** the system SHALL respond with 403 Forbidden
- **AND** SHALL not perform any generation

### Requirement: Deploy generated system
The system SHALL support triggering deployment of the generated system.

#### Scenario: Trigger deploy
- **WHEN** a user with permission `system:generate` requests deployment (e.g. for a given job or artifact)
- **THEN** the system SHALL accept the request via a dedicated API (e.g. POST deploy)
- **AND** SHALL require permission `system:generate`; otherwise SHALL return 403
- **AND** SHALL return a deploy identifier and status
- **AND** MAY run the deployment asynchronously; the API contract SHALL allow for async or sync behavior as defined in design

#### Scenario: Non-privileged user cannot deploy
- **WHEN** a user without `system:generate` calls the deploy API
- **THEN** the system SHALL respond with 403 Forbidden
- **AND** SHALL not trigger deployment

### Requirement: Highest permission for generate and deploy
The system SHALL treat “generate full system” and “deploy” as highest-privilege actions.

#### Scenario: Permission assignment for testing
- **WHEN** seed data or initial setup runs
- **THEN** the Admin role SHALL be granted permission `system:generate` so that in test environments an admin user can perform generate and deploy
- **AND** production MAY restrict `system:generate` to a dedicated super-admin or deploy role as configured
