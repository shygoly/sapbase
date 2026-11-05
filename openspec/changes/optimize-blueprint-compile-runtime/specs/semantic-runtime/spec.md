## ADDED Requirements

### Requirement: Query Index Plan

The semantic layer MAY declare `indexed: true` on a field. When declared, the runtime
MUST create an idempotent expression index that matches the query/sort expression used by
`record-query` (`data->>'field'` for text, `(data->>'field')::numeric` for numeric).

Index creation MUST be scoped by `blueprintId` and `entity` so multiple blueprints sharing
`blueprint_records` do not create conflicting indexes. Failure to create an index MUST fail
the write path explicitly; it MUST NOT silently continue.

#### Scenario: Indexed text field

- **GIVEN** an entity field `status` with `indexed: true`
- **WHEN** the runtime applies indexes
- **THEN** it SHALL create an index on `(data->>'status')` for that entity and blueprint
- **AND** the index SHALL include `blueprintId` and `organizationId` predicates

#### Scenario: Indexed numeric field

- **GIVEN** an entity field `amount` of type `decimal` with `indexed: true`
- **WHEN** the runtime applies indexes
- **THEN** it SHALL create an index on `((data->>'amount')::numeric)`

#### Scenario: Unindexed field

- **GIVEN** a field without `indexed: true`
- **WHEN** the runtime applies indexes
- **THEN** it MUST NOT create a query index for that field
