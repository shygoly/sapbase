# Patch DSL System Capability

## ADDED Requirements

### Requirement: Patch DSL Specification
The system SHALL provide a Patch DSL (Domain-Specific Language) that enables declarative modifications to schemas without direct code changes.

#### Scenario: Generate patch for adding field
- **WHEN** an AI or human wants to add a new field to a page
- **THEN** they SHALL generate a Patch JSON document with scope "page", operation "add", and field details in payload
- **AND** the patch SHALL include version, patchId, timestamp, actor, target, and payload fields
- **AND** the patch SHALL conform to the Patch DSL schema

#### Scenario: Generate patch for updating permission
- **WHEN** an AI or human wants to modify role permissions
- **THEN** they SHALL generate a Patch JSON with scope "permission", operation "update", and permission changes in payload
- **AND** the patch SHALL specify the target role and new allow/deny lists

### Requirement: Patch Validation System
The system SHALL validate all patches before execution using a rule-based validator.

#### Scenario: Validate patch against safety rules
- **WHEN** a patch is submitted for execution
- **THEN** the validator SHALL check that the patch does not delete system core fields (id, createdAt, updatedAt)
- **AND** SHALL check that permissions do not exceed actor's maximum permissions
- **AND** SHALL check that all referenced components exist in the component registry
- **AND** SHALL check that all field types are valid
- **AND** SHALL check that all object/view references exist
- **AND** if any validation fails, SHALL reject the patch with specific error messages

#### Scenario: Assign security level to patch
- **WHEN** a patch passes validation
- **THEN** the validator SHALL assign a security level (L1, L2, or L3) based on operation type and scope
- **AND** L1 patches SHALL be auto-executed (safe operations like adding fields)
- **AND** L2 patches SHALL require user confirmation (operations affecting permissions)
- **AND** L3 patches SHALL be blocked (dangerous operations like modifying auth)

### Requirement: Patch Execution Engine
The system SHALL provide a patch executor that applies patches to schema files without generating code.

#### Scenario: Execute add operation patch
- **WHEN** a validated patch with operation "add" is executed
- **THEN** the executor SHALL read the target schema file
- **AND** SHALL add the new element specified in payload
- **AND** SHALL write the updated schema back to file
- **AND** SHALL never generate or modify code files
- **AND** SHALL maintain valid JSON structure

#### Scenario: Execute update operation patch
- **WHEN** a validated patch with operation "update" is executed
- **THEN** the executor SHALL locate the target element in the schema
- **AND** SHALL update the element with values from payload
- **AND** SHALL preserve other elements unchanged
- **AND** SHALL write updated schema to file

#### Scenario: Execute remove operation patch
- **WHEN** a validated patch with operation "remove" is executed
- **THEN** the executor SHALL locate the target element
- **AND** SHALL remove the element from schema
- **AND** SHALL update any references if needed
- **AND** SHALL write updated schema to file

#### Scenario: Execute reorder operation patch
- **WHEN** a validated patch with operation "reorder" is executed
- **THEN** the executor SHALL reorder elements according to payload
- **AND** SHALL maintain all element data unchanged
- **AND** SHALL write updated schema with new order

### Requirement: Version Control System
The system SHALL maintain version history for all schema modifications through patches.

#### Scenario: Create new version on patch application
- **WHEN** a patch is successfully executed
- **THEN** the system SHALL create a new schema version
- **AND** SHALL assign an incremental version number
- **AND** SHALL store reference to previous version
- **AND** SHALL store patch ID, timestamp, and actor information
- **AND** SHALL store the complete schema snapshot

#### Scenario: Rollback to previous version
- **WHEN** a user requests rollback to a previous version
- **THEN** the system SHALL load the target version schema
- **AND** SHALL restore the schema file to that version
- **AND** SHALL create a new version record for the rollback
- **AND** SHALL invalidate schema cache to trigger reload

#### Scenario: View version history
- **WHEN** a user requests version history for a schema
- **THEN** the system SHALL return list of all versions
- **AND** SHALL include version number, timestamp, actor, and patch ID for each version
- **AND** SHALL allow comparison between versions

### Requirement: Hot Reloading Mechanism
The system SHALL support hot reloading of schema changes without requiring rebuild or restart.

#### Scenario: Hot reload after patch application
- **WHEN** a patch is successfully executed and schema file is updated
- **THEN** the system SHALL invalidate the SchemaResolver cache for the modified schema
- **AND** SHALL trigger React component re-render
- **AND** SHALL reload schema from file on next access
- **AND** SHALL update UI automatically without rebuild
- **AND** SHALL not require server restart

#### Scenario: Cache invalidation
- **WHEN** a schema file is modified via patch
- **THEN** the executor SHALL call `schemaResolver.clearCacheFor(type, name)` for the modified schema
- **AND** SHALL trigger re-fetch on next schema access
- **AND** SHALL ensure components using the schema receive updated data

### Requirement: Audit Logging
The system SHALL maintain a complete audit trail of all patch operations.

#### Scenario: Log patch application
- **WHEN** a patch is executed
- **THEN** the system SHALL log patch ID, timestamp, actor, scope, operation, target, and result
- **AND** SHALL store audit log entry in persistent storage
- **AND** SHALL include security level and validation results

#### Scenario: Query audit log
- **WHEN** a user requests audit log for a schema or time period
- **THEN** the system SHALL return all relevant audit entries
- **AND** SHALL include all patch details and execution results
- **AND** SHALL support filtering by actor, scope, operation, or date range

### Requirement: Five Patch Scopes
The system SHALL support five distinct patch scopes: page, object, permission, state, and menu.

#### Scenario: Page scope patch
- **WHEN** a patch has scope "page"
- **THEN** it SHALL modify page structure (fields, columns, layout)
- **AND** payload SHALL contain page-specific modification data
- **AND** target SHALL reference a page identifier

#### Scenario: Object scope patch
- **WHEN** a patch has scope "object"
- **THEN** it SHALL modify object schema (fields, validation, form structure)
- **AND** payload SHALL contain object-specific modification data
- **AND** target SHALL reference an object identifier

#### Scenario: Permission scope patch
- **WHEN** a patch has scope "permission"
- **THEN** it SHALL modify permission rules (role permissions, field permissions)
- **AND** payload SHALL contain allow/deny lists
- **AND** target SHALL reference a role or permission identifier

#### Scenario: State scope patch
- **WHEN** a patch has scope "state"
- **THEN** it SHALL modify state machine definitions (states, transitions)
- **AND** payload SHALL contain state machine modification data
- **AND** target SHALL reference a state machine identifier

#### Scenario: Menu scope patch
- **WHEN** a patch has scope "menu"
- **THEN** it SHALL modify navigation/menu structure (items, order, visibility)
- **AND** payload SHALL contain menu item data
- **AND** target SHALL reference a menu identifier

### Requirement: AI Tool Gateway Interface
The system SHALL provide an interface for AI to generate patches safely.

#### Scenario: AI generates patch
- **WHEN** an AI receives a modification request
- **THEN** it SHALL call the patch generation interface with intent and context
- **AND** SHALL receive a validated patch JSON in response
- **AND** SHALL never generate direct code modifications
- **AND** SHALL only return patches conforming to Patch DSL

#### Scenario: Patch generation request
- **WHEN** AI calls `generatePatch(intent, context)`
- **THEN** the system SHALL analyze intent and current schema
- **AND** SHALL generate appropriate patch JSON
- **AND** SHALL validate the generated patch
- **AND** SHALL return patch with security level and explanation

### Requirement: Dry Run Capability
The system SHALL support dry-run mode to preview patch effects without applying changes.

#### Scenario: Dry run patch
- **WHEN** a patch is submitted in dry-run mode
- **THEN** the executor SHALL simulate patch application
- **AND** SHALL return preview of changes
- **AND** SHALL show what would be modified
- **AND** SHALL not modify any files
- **AND** SHALL return validation results

### Requirement: Batch Patch Support
The system SHALL support applying multiple patches atomically.

#### Scenario: Apply batch patches
- **WHEN** multiple patches are submitted as a batch
- **THEN** the system SHALL validate all patches
- **AND** SHALL execute all patches atomically (all succeed or all fail)
- **AND** SHALL create single version record for the batch
- **AND** SHALL rollback all changes if any patch fails

### Requirement: Patch Dependencies
The system SHALL support patch dependencies for ordered execution.

#### Scenario: Execute dependent patches
- **WHEN** a patch specifies dependencies via `dependsOn` field
- **THEN** the executor SHALL ensure dependent patches are applied first
- **AND** SHALL validate dependency chain
- **AND** SHALL reject patches with circular dependencies
- **AND** SHALL execute patches in correct order
