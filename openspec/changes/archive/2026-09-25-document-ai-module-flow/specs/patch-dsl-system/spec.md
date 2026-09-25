## ADDED Requirements

### Requirement: Patch Metadata Extraction Shapes
Patch DSL SHALL expose module metadata in a structure that can be extracted for registry registration.

#### Scenario: Multi-entity object map
- **WHEN** a patch contains an `objects` map
- **THEN** the system SHALL derive the entity list from the object keys

#### Scenario: Single-entity fallback
- **WHEN** a patch declares `scope: "object"` and `target.identifier`
- **THEN** the system SHALL use the identifier as the single entity name

#### Scenario: Optional API and schema paths
- **WHEN** a patch includes `apiBasePath` or `schemaPath`
- **THEN** the system SHALL store those values in module metadata

#### Scenario: CRM multi-entity example
- **WHEN** a patch defines CRM entities (Customer, Order, OrderTracking, FinancialTransaction)
- **THEN** the system SHALL accept an `objects` map containing those keys
