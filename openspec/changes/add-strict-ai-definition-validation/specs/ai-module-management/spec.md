## ADDED Requirements

### Requirement: Strict Definition JSON Validation

Every AI definition step output SHALL be validated against its step-specific JSON Schema
before it is returned to the client or persisted.

Validation failure SHALL return a clear error containing the step id and field path.
The backend MUST NOT persist an invalid step.

#### Scenario: Valid object model

- **WHEN** the AI returns `{ entities: [{ identifier, fields }] }` matching the object-model schema
- **THEN** the step SHALL be accepted and persisted

#### Scenario: Invalid field type

- **WHEN** a field declares an unsupported `type`
- **THEN** the request SHALL fail with the field path and allowed types
- **AND** no definition row SHALL be written

#### Scenario: Persisted definition is validated

- **WHEN** `saveDefinition` receives a definition with a non-empty invalid step
- **THEN** it SHALL reject the write
- **AND** existing persisted data SHALL remain unchanged

### Requirement: Deterministic Definition to Blueprint

`generateFromDefinition` SHALL convert the six-step definition to Blueprint layers
deterministically. It MUST NOT call an LLM for a second “Model DSL” translation.

The resulting `patchContent` SHALL contain `objects` and the Blueprint layers
(`semantic`, `flows`, and optional `rules` / `experience`) so existing publish metadata
extraction continues to work.

#### Scenario: Nested definition

- **WHEN** the definition uses `objectModel` / `stateFlow`
- **THEN** conversion SHALL produce semantic and flows layers

#### Scenario: Flat wizard payload

- **WHEN** the definition uses `entities` / `states` / `transitions`
- **THEN** it SHALL be normalized to the same internal shape before conversion

#### Scenario: Conversion failure

- **WHEN** an entity has no state machine or a field has an invalid name
- **THEN** the request SHALL fail with the conversion reason
- **AND** no module patch content SHALL be overwritten

### Requirement: No Silent Empty Patch

AI response extraction MUST fail explicitly when the response contains no JSON object or
invalid JSON. It MUST NOT substitute a default empty patch.

#### Scenario: Malformed response

- **WHEN** the model returns prose without a JSON object
- **THEN** the request SHALL fail with a parsing error
- **AND** no module record SHALL be updated
