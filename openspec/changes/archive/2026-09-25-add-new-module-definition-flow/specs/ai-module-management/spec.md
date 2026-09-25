## ADDED Requirements

### Requirement: New Module Definition Flow (6 Steps)
The system SHALL support creating a new module through a fixed 6-step definition order, distinct from applying incremental patches.

#### Scenario: Step order for new module
- **WHEN** a user creates a new module (not modifying an existing one)
- **THEN** the system SHALL present steps in order: 1 Object model, 2 Relationships, 3 State flow, 4 Pages, 5 Permissions, 6 Reports
- **AND** each step SHALL collect or generate the corresponding artifact (unified object model, relationships, state machine DSL, page schema, permission DSL, report config)
- **AND** the result SHALL NOT be a single prompt-to-patch; it SHALL be structured definitions that can later be modified by patches

#### Scenario: CRM example complexity
- **WHEN** the module is CRM-style
- **THEN** relationships SHALL support chains such as Lead → Account → Opportunity → Contract
- **AND** state flow SHALL support transitions such as draft → qualified → proposal → won → lost
- **AND** permission rules SHALL support sales (own only), manager (all), finance (e.g. contracts only)

### Requirement: New Module Definition Step Component
The system SHALL provide a step component (wizard) for the 6-step new module definition.

#### Scenario: Wizard renders all six steps
- **WHEN** the user chooses to create a new module via the definition flow
- **THEN** the UI SHALL show a stepper with steps: Object model, Relationships, State flow, Pages, Permissions, Reports
- **AND** the user SHALL be able to move next/back and complete or skip steps within the flow
- **AND** state SHALL be retained across steps until submission
