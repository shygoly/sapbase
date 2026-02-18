# DSL Management Specification

## ADDED Requirements

### Requirement: View Module DSL
The system SHALL provide functionality to view the Module DSL (Model DSL) stored in an AI module's `patchContent` field.

#### Scenario: View Module DSL for a module
- **WHEN** a user requests to view the Module DSL for an AI module
- **THEN** the system SHALL return the `patchContent` field as formatted JSON
- **AND** the JSON SHALL be displayed in a readable format (syntax highlighting, formatting)

#### Scenario: Module DSL not found
- **WHEN** a user requests Module DSL for a module that has no `patchContent`
- **THEN** the system SHALL return an appropriate error message indicating no DSL is available

### Requirement: View 6-Step Definition
The system SHALL provide functionality to view the complete 6-step definition stored in the `ai_module_definitions` table.

#### Scenario: View 6-step definition
- **WHEN** a user requests to view the 6-step definition for an AI module
- **THEN** the system SHALL return all 6 steps (objectModel, relationships, stateFlow, pages, permissions, reports)
- **AND** each step SHALL be displayed separately with clear labels
- **AND** the merged definition SHALL also be available

#### Scenario: 6-step definition not found
- **WHEN** a user requests 6-step definition for a module that doesn't have one
- **THEN** the system SHALL return an appropriate error message

### Requirement: Export DSL
The system SHALL provide functionality to export DSL definitions as JSON files.

#### Scenario: Export Module DSL
- **WHEN** a user requests to export a Module DSL
- **THEN** the system SHALL generate a JSON file containing the `patchContent`
- **AND** the file SHALL be downloadable with a descriptive filename (e.g., `module-{id}-dsl.json`)

#### Scenario: Export 6-step definition
- **WHEN** a user requests to export a 6-step definition
- **THEN** the system SHALL generate a JSON file containing all 6 steps and merged definition
- **AND** the file SHALL be downloadable with a descriptive filename (e.g., `module-{id}-definition.json`)

### Requirement: Browse DSL Definitions
The system SHALL provide a browsing interface to list and search DSL definitions.

#### Scenario: List all modules with DSL
- **WHEN** a user navigates to the DSL management page
- **THEN** the system SHALL display a list of all AI modules that have DSL definitions
- **AND** each entry SHALL show module name, status, and last updated timestamp

#### Scenario: Search DSL by module name
- **WHEN** a user searches for modules by name
- **THEN** the system SHALL filter the list to show matching modules
- **AND** the search SHALL be case-insensitive

### Requirement: DSL Format Display
The system SHALL display DSL definitions in a user-friendly format.

#### Scenario: Formatted JSON display
- **WHEN** a DSL definition is displayed
- **THEN** the JSON SHALL be formatted with proper indentation
- **AND** syntax highlighting SHALL be applied for better readability
- **AND** long JSON values SHALL be truncated or collapsible

## REMOVED Requirements

### Requirement: Code Generation from DSL
**Reason**: Code generation functionality is not mature and has been removed. DSL definitions are now treated as data artifacts for viewing and export only.

**Migration**: Users who need to generate code from DSL should use external tools or wait for a future implementation.

### Requirement: Automatic Code Deployment
**Reason**: Depends on code generation functionality which has been removed.

**Migration**: N/A - functionality not yet implemented in production.
