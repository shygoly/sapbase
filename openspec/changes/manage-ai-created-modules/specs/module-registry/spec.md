# Module Registry Specification

## ADDED Requirements

### Requirement: Module Registry System
The system SHALL maintain a centralized registry of all AI-created modules with comprehensive metadata, capabilities, relationships, and status information.

#### Scenario: Module Registration on Creation
- **WHEN** an AI module is created and published
- **THEN** the module SHALL be automatically registered in the module registry
- **AND** SHALL include metadata such as name, description, module type, version, AI model used, and creator
- **AND** SHALL extract capabilities from the patch DSL content
- **AND** SHALL initialize module statistics tracking
- **AND** SHALL set initial status to "active"

#### Scenario: Module Metadata Management
- **WHEN** a module is registered
- **THEN** the registry SHALL store:
  - Module ID, name, description
  - Module type (CRUD, workflow, integration, etc.)
  - Creation date, AI model used, creator information
  - Current version and status
  - Reference to the AI module patch
  - Schema paths and API base paths
  - List of entities included in the module

#### Scenario: Module Capability Tracking
- **WHEN** a module is registered
- **THEN** the system SHALL automatically detect and record:
  - Available operations (CRUD, queries, actions)
  - API endpoints exposed by the module
  - Data models and schemas
  - Business logic capabilities
- **AND** SHALL update capabilities when module is modified

#### Scenario: Module Relationship Management
- **WHEN** modules have dependencies or integrations
- **THEN** the system SHALL support defining relationships with types:
  - Dependency (module A depends on module B)
  - Integration (module A integrates with module B)
  - Data flow (module A provides data to module B)
  - Hierarchical (parent-child modules)
- **AND** SHALL validate relationships to prevent circular dependencies
- **AND** SHALL provide visualization of module relationships

#### Scenario: Module Status and Health Tracking
- **WHEN** a module is registered
- **THEN** the system SHALL track:
  - Current status (active, inactive, deprecated, error)
  - Data statistics (record counts per entity, last update timestamps)
  - Performance metrics (response times, error rates)
  - Health status (healthy, warning, error)
- **AND** SHALL update statistics periodically
- **AND** SHALL alert on health status changes

#### Scenario: Module Configuration Documentation
- **WHEN** a module is registered
- **THEN** the system SHALL support:
  - Configuration schema definition
  - Usage documentation
  - API documentation generation
  - Relationship documentation
- **AND** SHALL allow editing configuration and documentation through UI

### Requirement: CRM Module Registration
The CRM module SHALL be registered in the module registry with complete metadata and capabilities.

#### Scenario: CRM Module Registration
- **WHEN** the CRM module registration is performed
- **THEN** the system SHALL register:
  - Name: "CRM Module"
  - Description: Customer Relationship Management module
  - Module type: "crud"
  - Entities: Customer, Order, OrderTracking, FinancialTransaction
  - Capabilities: Full CRUD operations for all entities
  - API endpoints: /crm/customers, /crm/orders, /crm/order-tracking, /crm/transactions
  - Schema paths: /public/specs/modules/crm
- **AND** SHALL initialize statistics for all CRM entities
- **AND** SHALL set status to "active"

#### Scenario: CRM Module Capabilities
- **WHEN** CRM module is queried for capabilities
- **THEN** the system SHALL return:
  - Customer entity: create, read, update, delete, list operations
  - Order entity: create, read, update, delete, list operations
  - OrderTracking entity: create, read, update, delete, list operations
  - FinancialTransaction entity: create, read, update, delete, list operations
- **AND** SHALL include API endpoint information for each capability

### Requirement: AI Context Awareness
The AI system SHALL be able to query the module registry to understand existing modules, their capabilities, relationships, and status.

#### Scenario: AI Module Listing
- **WHEN** AI system queries for available modules
- **THEN** the system SHALL return a list of all registered modules
- **AND** SHALL include basic information: name, description, type, status
- **AND** SHALL allow filtering by status, type, AI model

#### Scenario: AI Module Details Query
- **WHEN** AI system queries for a specific module's details
- **THEN** the system SHALL return:
  - Complete module metadata
  - All capabilities and operations
  - Module relationships
  - Current statistics and health status
  - Configuration requirements
- **AND** SHALL provide this information in a format suitable for AI processing

#### Scenario: AI Capability Awareness
- **WHEN** AI system queries for module capabilities
- **THEN** the system SHALL return:
  - Available operations for each entity
  - API endpoints for each operation
  - Data model schemas
  - Business logic capabilities
- **AND** SHALL enable AI to understand existing capabilities before generating new modules

#### Scenario: AI Relationship Awareness
- **WHEN** AI system queries for module relationships
- **THEN** the system SHALL return:
  - Dependencies between modules
  - Integration points
  - Data flow relationships
  - Hierarchical relationships
- **AND** SHALL enable AI to understand module dependencies when making modifications

#### Scenario: AI Statistics Awareness
- **WHEN** AI system queries for module statistics
- **THEN** the system SHALL return:
  - Record counts per entity
  - Last update timestamps
  - Performance metrics
  - Health status
- **AND** SHALL enable AI to understand module usage and health

### Requirement: Module Registry UI
The system SHALL provide a user interface for managing the module registry.

#### Scenario: Module Registry List View
- **WHEN** a user accesses the module registry
- **THEN** the system SHALL display a table/list of all registered modules
- **AND** SHALL show: name, description, type, status, version, last update
- **AND** SHALL support filtering by status, type, AI model
- **AND** SHALL support searching by name or description
- **AND** SHALL provide actions: view details, edit, disable/enable

#### Scenario: Module Detail View
- **WHEN** a user views a module's details
- **THEN** the system SHALL display:
  - Complete module metadata
  - List of capabilities
  - Visual representation of relationships (graph)
  - Statistics dashboard
  - Configuration editor
  - Documentation editor
- **AND** SHALL allow editing module information
- **AND** SHALL allow managing relationships

#### Scenario: Module Relationship Visualization
- **WHEN** a user views module relationships
- **THEN** the system SHALL display an interactive graph showing:
  - Modules as nodes
  - Relationships as edges
  - Relationship types indicated by edge styles/colors
- **AND** SHALL allow filtering by relationship type
- **AND** SHALL allow adding/removing relationships

## MODIFIED Requirements

### Requirement: AI Module Creation Integration
The AI module creation process SHALL automatically register modules in the module registry.

#### Scenario: Auto-Registration on Module Creation
- **WHEN** an AI module is created and published
- **THEN** the system SHALL automatically:
  - Register the module in the module registry
  - Extract capabilities from patch DSL
  - Initialize module statistics
  - Set up default configuration
- **AND** SHALL NOT require manual registration
