# module-registry Specification

## Purpose
TBD - created by archiving change document-ai-module-flow. Update Purpose after archive.
## Requirements
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

### Requirement: Registry Metadata Derived from Patch DSL
When registering an AI module, the system SHALL derive module metadata and capabilities from Patch DSL content.

#### Scenario: Register metadata on publish
- **WHEN** a module is published with Patch DSL content
- **THEN** the registry SHALL store entities, `apiBasePath`, and `schemaPath` derived from the patch

#### Scenario: Update registry on re-publish
- **WHEN** a published module is re-published
- **THEN** the registry SHALL update the existing registry entry with the latest metadata

#### Scenario: Capabilities derived per entity
- **WHEN** entities are derived from a patch
- **THEN** the registry SHALL generate CRUD capabilities per entity
- **AND** SHALL generate API endpoints using the patch `apiBasePath` and pluralized entity names

