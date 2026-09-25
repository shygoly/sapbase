## ADDED Requirements

### Requirement: Patch Metadata Extraction Shape
The Patch DSL SHALL expose module metadata in a structure that can be programmatically extracted for module registration.

#### Scenario: Multi-entity object map
- **WHEN** a patch includes an `objects` map
- **THEN** the system SHALL derive the entity list from the object keys

#### Scenario: Single-entity fallback
- **WHEN** a patch declares `scope: "object"` and `target.identifier`
- **THEN** the system SHALL use the identifier as the single entity name

#### Scenario: Objects precedence
- **WHEN** a patch includes both `objects` and `scope/target`
- **THEN** the system SHALL prioritize the `objects` map for entity extraction

#### Scenario: Optional API and schema paths
- **WHEN** a patch includes `apiBasePath` or `schemaPath`
- **THEN** the system SHALL record those values in module metadata
