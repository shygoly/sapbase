# Multi-Tenant Architecture Specification

## ADDED Requirements

### Requirement: Organization Entity
The system SHALL support multiple organizations (tenants) as independent entities.

#### Scenario: Create organization
- **WHEN** an admin user creates a new organization
- **THEN** the system SHALL create an Organization record with name, slug, and unique identifier
- **AND** the creator SHALL be assigned as Owner role
- **AND** the organization SHALL be assigned a default subscription plan

#### Scenario: Organization uniqueness
- **WHEN** creating an organization with a name or slug that already exists
- **THEN** the system SHALL reject the creation with an appropriate error message

### Requirement: Organization Membership
Users SHALL be able to belong to multiple organizations with different roles in each.

#### Scenario: User joins organization
- **WHEN** a user accepts an invitation to join an organization
- **THEN** the system SHALL create an OrganizationMember record
- **AND** the user SHALL gain access to that organization's data
- **AND** the user's role in that organization SHALL be recorded

#### Scenario: User belongs to multiple organizations
- **WHEN** a user is a member of multiple organizations
- **THEN** the system SHALL allow the user to switch between organizations
- **AND** each organization SHALL maintain independent data and settings

### Requirement: Organization Context
All API requests SHALL be scoped to a specific organization context.

#### Scenario: API request with organization context
- **WHEN** a user makes an API request
- **THEN** the system SHALL extract the organizationId from the request (header, query param, or JWT)
- **AND** all data queries SHALL be filtered by organizationId
- **AND** users SHALL only access data from organizations they belong to

#### Scenario: Missing organization context
- **WHEN** an API request is made without organization context
- **THEN** the system SHALL return an error indicating organization context is required
- **EXCEPT** for organization management endpoints that create/switch organizations

### Requirement: Organization Switching
Users SHALL be able to switch between their organizations.

#### Scenario: Switch organization
- **WHEN** a user selects a different organization from the switcher
- **THEN** the system SHALL update the organization context
- **AND** the UI SHALL refresh to show data from the selected organization
- **AND** subsequent API requests SHALL use the new organization context

## MODIFIED Requirements

### Requirement: User Authentication
User authentication SHALL be modified to support organization context.

#### Scenario: Login with organization context
- **WHEN** a user logs in
- **THEN** the system SHALL fetch all organizations the user belongs to
- **AND** if the user belongs to exactly one organization, it SHALL be auto-selected
- **AND** if the user belongs to multiple organizations, the system SHALL prompt for selection
- **AND** the JWT token SHALL include the selected organizationId

#### Scenario: User with no organizations
- **WHEN** a user logs in but belongs to no organizations
- **THEN** the system SHALL redirect to organization creation or invitation acceptance flow
