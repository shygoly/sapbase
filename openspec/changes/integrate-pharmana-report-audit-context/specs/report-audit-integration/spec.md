## ADDED Requirements

### Requirement: Tenant-scoped Report Context
The system SHALL provide tenant-scoped report lifecycle APIs for creating, listing, generating, and finalizing reports.

#### Scenario: Create and list report in organization scope
- **WHEN** an authenticated user with `organizationId` creates a report via report context API
- **THEN** the report is stored with that `organizationId`
- **AND** list queries return only reports in the same organization scope

### Requirement: Immutable Audit Context
The system SHALL provide append-only audit logging where audit entries cannot be mutated or deleted through application APIs.

#### Scenario: Append and query audit logs
- **WHEN** an operation emits an audit event
- **THEN** a new audit record is appended
- **AND** querying returns records filtered by `organizationId`, entity, and time range
- **AND** no update/delete API exists for audit entries

### Requirement: Pharmana Compatibility for Report and Audit APIs
The system SHALL expose compatibility routes for critical Pharmana report and audit endpoints, mapped to native report/audit contexts.

#### Scenario: Compatibility report endpoint delegates to native context
- **WHEN** a client calls a Pharmana compatibility report route
- **THEN** the request is handled by the compatibility layer
- **AND** response payload is derived from native report context services

#### Scenario: Compatibility audit endpoint delegates to native context
- **WHEN** a client calls a Pharmana compatibility audit route
- **THEN** the request is handled by the compatibility layer
- **AND** response payload is derived from native audit context services
