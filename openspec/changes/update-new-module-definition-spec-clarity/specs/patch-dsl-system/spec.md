## MODIFIED Requirements

### Requirement: Patch Protocol Schema
A patch document SHALL conform to a single schema used for all incremental changes to a module, with an unambiguous canonical scope set.

#### Scenario: Patch document shape
- **WHEN** a patch is produced (by AI or human)
- **THEN** it SHALL include: version ("1.0"), patchId (UUID), timestamp (ISO-8601), actor ("ai" | "human")
- **AND** it SHALL include: scope (page | object | permission | state | menu), operation (add | update | remove | reorder | replace)
- **AND** it SHALL include: target (type, identifier) and payload (scope-specific)

#### Scenario: Five patch types
- **WHEN** classifying patches by scope
- **THEN** page structure patches SHALL use scope "page"
- **AND** form/object structure patches SHALL use scope "object"
- **AND** permission rule patches SHALL use scope "permission"
- **AND** state machine patches SHALL use scope "state"
- **AND** menu/navigation patches SHALL use scope "menu"

#### Scenario: Layout terminology mapping
- **WHEN** documentation or users refer to "layout" patches
- **THEN** the system SHALL map "layout" semantics to scope "page"
- **AND** the runtime patch scope enumeration SHALL remain page | object | permission | state | menu

### Requirement: Publish Pipeline for Patches
The system SHALL apply patches through a defined pipeline before schema changes are persisted.

#### Scenario: Pipeline sequence before schema persistence
- **WHEN** a patch apply action is triggered (after AI or human produces the patch)
- **THEN** the system SHALL run: Validator -> Dry Run -> Apply -> Versioned Save
- **AND** Validator SHALL reject invalid patches and assign security level
- **AND** Dry Run SHALL simulate application without writing
- **AND** Apply SHALL modify schemas via the patch executor
- **AND** Versioned Save SHALL create a new schema version with patch metadata

#### Scenario: Publish status does not imply schema applied
- **WHEN** module lifecycle status is set to published
- **THEN** the system SHALL NOT claim schema changes were applied unless the patch pipeline completed successfully
- **AND** if pipeline completion is decoupled from lifecycle status, the system SHALL keep these states explicit and non-ambiguous
