## ADDED Requirements

### Requirement: Business App Installation

The system SHALL represent each installed business application as a tenant-scoped
`AppInstallation` bound to a concrete signed Blueprint release.

#### Scenario: Install an application

- **WHEN** an authorized user installs an entitled Blueprint release into an organization
- **THEN** the system SHALL create an installation with a stable app key, release digest, license,
  deployment profile, and initial lifecycle state
- **AND** the installation SHALL be idempotent for the same organization and release revision

#### Scenario: Reject an unentitled installation

- **WHEN** the release is unsigned, unauthorized, expired, or not entitled to the organization
- **THEN** installation SHALL fail before any app data or active binding is created

### Requirement: Trusted App Execution Context

Every app-scoped API, job, Outbox consumer, and Agent run SHALL execute with a trusted context
containing organization, app installation, user or service principal, permissions, deployment
profile, and trace identifier.

#### Scenario: Resolve app context

- **WHEN** a request names an app installation
- **THEN** the platform SHALL validate membership, entitlement, lifecycle, and release authorization
  before resolving the app context
- **AND** caller-provided organization, app key, or permission fields SHALL NOT be accepted as proof

#### Scenario: Missing app context

- **WHEN** an app-scoped operation lacks a valid installation context
- **THEN** the operation SHALL be rejected without reading or writing app-owned data

### Requirement: Tenant and App Data Isolation

Tenant-owned and app-owned rows SHALL be protected by PostgreSQL row-level security in addition to
service-level predicates.

#### Scenario: Cross-tenant raw query

- **WHEN** code bypasses service predicates and executes SQL under tenant A context
- **THEN** the database SHALL return only tenant A rows

#### Scenario: Cross-app private read

- **WHEN** an operation in app installation A reads a private record owned by app installation B
  in the same organization
- **THEN** the read SHALL be rejected

### Requirement: Explicit Cross-App Data Capability

Applications SHALL access another application's data only through an explicitly published and
authorized data capability.

#### Scenario: Consume a published capability

- **WHEN** CRM calls an ERP-published `customer.lookup` capability for the current organization
- **THEN** the platform SHALL check the caller app, user scope, capability permission, and owner data
  scope
- **AND** the result SHALL contain only the projection allowed by that capability

#### Scenario: Direct cross-app access

- **WHEN** an app tool or service tries to query another app's `blueprint_records` directly
- **THEN** the operation SHALL be rejected

### Requirement: App-Scoped Catalogs

Modules, tools, permissions, menus, Agents, audit views, and usage SHALL be resolvable per installed
application without changing the platform kernel.

#### Scenario: Compose an app catalog

- **WHEN** an application is activated
- **THEN** the platform SHALL compose its tools and modules from the platform catalog, Blueprint
  release, installed integrations, and published shared capabilities
- **AND** duplicate tool names or unsatisfied dependencies SHALL make the composed catalog invalid

#### Scenario: Change application

- **WHEN** a user switches from ERP to CRM in the same organization
- **THEN** navigation, available tools, permissions, and Agent context SHALL resolve for CRM
- **AND** ERP interaction surfaces SHALL NOT be carried into CRM

### Requirement: Application Lifecycle and Rollback

The system SHALL manage installation lifecycle and release revisions without mutating historical
release artifacts.

#### Scenario: Upgrade an application

- **WHEN** an authorized compatible release is installed over an active application
- **THEN** the system SHALL record a new installation revision and retain the previous revision
- **AND** activation SHALL require successful data-compatibility checks

#### Scenario: Roll back an unsafe upgrade

- **WHEN** an upgrade fails validation or compatibility checks
- **THEN** the active installation SHALL remain on its previous revision

### Requirement: Uniform Runtime Deployment Profiles

Shared SaaS, dedicated SaaS, and standalone deployments SHALL consume the same Blueprint and Runtime
contracts.

#### Scenario: Deliver one release to multiple profiles

- **WHEN** the same signed release is activated under different deployment profiles
- **THEN** its compiled IR and capability contracts SHALL be equivalent
- **AND** only the data isolation, licensing, and operations adapters MAY differ

#### Scenario: Standalone package

- **WHEN** an authorized standalone bundle is produced
- **THEN** it SHALL contain a pinned Runtime, signed Blueprint release, required capabilities,
  configuration schema, and offline or lease license policy
