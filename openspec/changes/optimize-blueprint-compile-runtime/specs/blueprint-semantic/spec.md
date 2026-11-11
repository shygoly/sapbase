## ADDED Requirements

### Requirement: Explicit Query Index Declaration

The semantic layer MAY declare `indexed: boolean` on a field; the compiler SHALL treat `indexed` only as a
query index candidate; it MUST NOT change validation, uniqueness or storage semantics.

#### Scenario: indexed is optional

- **GIVEN** a field without `indexed`
- **WHEN** the package is compiled
- **THEN** compilation SHALL succeed
- **AND** no query index SHALL be planned for that field

#### Scenario: indexed remains orthogonal to unique

- **GIVEN** a field with `unique: true` and `indexed: true`
- **WHEN** indexes are applied
- **THEN** the unique index SHALL still be created
- **AND** the query index plan SHALL remain independent
