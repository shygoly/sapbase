## ADDED Requirements

### Requirement: AI Module Lifecycle Documentation
The system SHALL define the AI module lifecycle states and the transitions between them.

#### Scenario: Create module
- **WHEN** a module is created
- **THEN** the system SHALL set its status to `draft`

#### Scenario: Submit for review
- **WHEN** a tested module is submitted for review
- **THEN** the system SHALL transition the status to `pending_review`

#### Scenario: Review decision
- **WHEN** a reviewer approves or rejects a module
- **THEN** the system SHALL update status to `approved` or `rejected` and store review comments

#### Scenario: Publish and unpublish
- **WHEN** an approved module is published
- **THEN** the system SHALL set status to `published`
- **AND** SHALL set `publishedAt`
- **WHEN** a published module is unpublished
- **THEN** the system SHALL set status to `unpublished`
- **AND** SHALL set `unpublishedAt`

### Requirement: Patch Generation and Storage
The system SHALL persist patch generation inputs and outputs for AI modules.

#### Scenario: Persist prompt and patch
- **WHEN** a natural language prompt is submitted for a module
- **THEN** the system SHALL store the prompt and the generated Patch DSL JSON in `patchContent`

#### Scenario: Persist test results
- **WHEN** tests are executed for a module
- **THEN** the system SHALL store `testResults` including pass/fail summary
