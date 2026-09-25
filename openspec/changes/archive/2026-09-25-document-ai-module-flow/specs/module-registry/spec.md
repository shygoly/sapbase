## ADDED Requirements

### Requirement: Module Registry Registration on Publish
The system SHALL register AI modules in the Module Registry when they are published.

#### Scenario: Register module metadata
- **WHEN** a module is published with Patch DSL content
- **THEN** the registry SHALL store the derived entity list and metadata

#### Scenario: Update existing registry entry
- **WHEN** a published module is re-published
- **THEN** the registry SHALL update the existing entry rather than creating a duplicate

#### Scenario: Derive capabilities per entity
- **WHEN** entities are derived from Patch DSL
- **THEN** the registry SHALL generate CRUD capabilities for each entity
