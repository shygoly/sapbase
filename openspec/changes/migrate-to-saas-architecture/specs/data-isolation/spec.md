# Data Isolation Specification

## ADDED Requirements

### Requirement: Tenant Data Isolation
All tenant-scoped data SHALL be isolated by organizationId.

#### Scenario: Query filtering
- **WHEN** a service queries tenant-scoped data
- **THEN** the query SHALL automatically include organizationId filter
- **AND** only data belonging to the current organization context SHALL be returned
- **AND** users SHALL never see data from other organizations

#### Scenario: Create tenant-scoped data
- **WHEN** a user creates a new record (e.g., Department, Role, AIModule)
- **THEN** the system SHALL automatically assign the current organizationId
- **AND** the user SHALL NOT be able to specify a different organizationId
- **EXCEPT** for admin users with special permissions

### Requirement: Cross-Tenant Data Access Prevention
Users SHALL be prevented from accessing data outside their organizations.

#### Scenario: Direct ID access attempt
- **WHEN** a user attempts to access a resource by ID from another organization
- **THEN** the system SHALL return 404 Not Found (not 403 Forbidden to prevent ID enumeration)
- **AND** the attempt SHALL be logged for security monitoring

#### Scenario: API request without organization context
- **WHEN** an API request is made without valid organization context
- **THEN** the system SHALL return 400 Bad Request
- **AND** the error message SHALL indicate organization context is required

### Requirement: Global Data vs Tenant Data
The system SHALL distinguish between global data and tenant-scoped data.

#### Scenario: Global data access
- **WHEN** data is marked as global (e.g., system settings, AI models)
- **THEN** the data SHALL be accessible across all organizations
- **AND** global data SHALL not have organizationId

#### Scenario: Tenant-scoped data
- **WHEN** data is tenant-scoped (e.g., Departments, Roles, Users within org)
- **THEN** the data SHALL be isolated by organizationId
- **AND** queries SHALL automatically filter by organizationId

### Requirement: Admin Override
System administrators SHALL be able to access data across organizations for support purposes.

#### Scenario: Admin cross-tenant access
- **WHEN** a user with system:admin permission accesses data
- **THEN** the system SHALL allow access to data from any organization
- **AND** the access SHALL be logged for audit purposes
- **AND** admin actions SHALL be clearly marked in logs

## MODIFIED Requirements

### Requirement: Entity Schema
All tenant-scoped entities SHALL include organizationId.

#### Scenario: Entity modification
- **WHEN** modifying an entity to be tenant-scoped
- **THEN** the entity SHALL include organizationId column
- **AND** the entity SHALL include ManyToOne relation to Organization
- **AND** database migration SHALL add organizationId with appropriate constraints

### Requirement: Query Builders
All repository queries SHALL be tenant-aware.

#### Scenario: Service query modification
- **WHEN** a service method queries tenant-scoped data
- **THEN** the query SHALL include organizationId filter
- **AND** the filter SHALL be applied automatically via interceptor or base repository method
- **AND** manual queries SHALL also include organizationId filter
