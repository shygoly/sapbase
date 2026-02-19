## MODIFIED Requirements

### Requirement: Workflow Definition Management

The system SHALL allow users to define workflows that specify states and transitions for entities.

**Architecture Note**: Workflow definitions are managed through domain entities (`WorkflowDefinition`) with business methods for validation and activation. Application services orchestrate workflow creation, and infrastructure repositories handle persistence.

#### Scenario: Create Workflow Definition

**Given** a user with workflow management permissions  
**When** they create a workflow definition with:
- Entity type (e.g., "Opportunity")
- States: [{ name: "draft", initial: true }, { name: "qualified", initial: false }, { name: "won", final: true }]
- Transitions: [{ from: "draft", to: "qualified" }, { from: "qualified", to: "won" }]

**Then** the workflow definition SHALL be stored  
**And** the workflow SHALL be associated with the user's organization  
**And** the workflow SHALL be versioned  
**And** the workflow SHALL be available for use with entities of the specified type  
**And** business rules SHALL be enforced by domain entities (e.g., exactly one initial state required)

#### Scenario: Auto-generate Workflow from State Flow

**Given** an AI module with `step3_stateFlow` definition containing state machine data  
**When** the module is published  
**Then** a WorkflowDefinition SHALL be automatically created from the state flow  
**And** the workflow SHALL be linked to the module via ModuleRegistry  
**And** the workflow SHALL use the entity types defined in the module  
**And** domain validation SHALL ensure workflow integrity before persistence

### Requirement: Workflow Instance Management

The system SHALL create and manage workflow instances for entities.

**Architecture Note**: Workflow instances are domain entities with business methods for state transitions. Application services handle use cases (start instance, query instance), and infrastructure repositories manage persistence.

#### Scenario: Start Workflow for Entity

**Given** a WorkflowDefinition exists for entity type "Opportunity"  
**And** an Opportunity entity exists with id "opp-123"  
**When** a user starts the workflow for this entity  
**Then** a WorkflowInstance SHALL be created  
**And** the instance SHALL be in the initial state  
**And** the instance SHALL reference the entity (entityType="Opportunity", entityId="opp-123")  
**And** the instance SHALL record who started it and when  
**And** domain events SHALL be published (WorkflowInstanceStartedEvent)

#### Scenario: Query Workflow Instance

**Given** a WorkflowInstance exists for an entity  
**When** a user queries the workflow instance by entity  
**Then** the system SHALL return:
- Current state
- Available transitions
- Workflow status (running, completed, failed)
- Start and completion timestamps  
**And** the query SHALL be handled by application services using repository interfaces

### Requirement: State Transition Execution

The system SHALL execute state transitions with validation and guard conditions.

**Architecture Note**: Transition validation is performed by domain services (pure business logic). Application services orchestrate the transition, coordinate with external services (AI guards) via interfaces, and publish domain events. Infrastructure handles persistence and external API calls.

#### Scenario: Execute Valid Transition

**Given** a WorkflowInstance in state "draft"  
**And** a transition exists from "draft" to "qualified"  
**And** the user has permission to execute the transition  
**When** the user triggers the transition  
**Then** the workflow instance SHALL move to state "qualified"  
**And** the entity's state field SHALL be updated to "qualified"  
**And** a history entry SHALL be recorded  
**And** the transition SHALL complete successfully  
**And** domain events SHALL be published (WorkflowTransitionedEvent)  
**And** transition validation SHALL be performed by domain services

#### Scenario: Reject Invalid Transition

**Given** a WorkflowInstance in state "draft"  
**And** no transition exists from "draft" to "won"  
**When** a user attempts to transition directly to "won"  
**Then** the transition SHALL be rejected  
**And** an error SHALL be returned indicating invalid transition  
**And** the workflow state SHALL remain unchanged  
**And** validation SHALL be performed by domain services before any persistence

#### Scenario: Guard Condition Enforcement

**Given** a WorkflowInstance in state "qualified"  
**And** a transition from "qualified" to "won" exists with guard condition: `entity.value >= 10000`  
**And** the entity value is 5000  
**When** a user attempts to transition to "won"  
**Then** the guard condition SHALL be evaluated  
**And** the transition SHALL be rejected  
**And** an error SHALL indicate the guard condition failed  
**And** the workflow state SHALL remain unchanged  
**And** expression guards SHALL be evaluated by domain services  
**And** AI guards SHALL be evaluated via infrastructure services implementing domain interfaces

### Requirement: Workflow History

The system SHALL record all workflow events for audit and debugging.

**Architecture Note**: History recording is handled by infrastructure repositories. Domain events may trigger history creation, but history itself is an infrastructure concern.

#### Scenario: Record Transition History

**Given** a WorkflowInstance  
**When** a state transition is executed  
**Then** a WorkflowHistory entry SHALL be created with:
- From state and to state
- Timestamp
- User who triggered the transition
- Guard condition result (if applicable)
- Action execution result (if applicable)
- Metadata (context, variables)  
**And** history SHALL be persisted via infrastructure repositories

#### Scenario: Query Workflow History

**Given** a WorkflowInstance with multiple transitions  
**When** a user queries the workflow history  
**Then** the system SHALL return all history entries in chronological order  
**And** each entry SHALL include all transition details  
**And** the history SHALL be paginated for large datasets  
**And** queries SHALL be handled by application services using repository interfaces

### Requirement: Multi-tenant Isolation

Workflow definitions and instances SHALL be isolated by organization.

**Architecture Note**: Multi-tenancy is enforced at the application and infrastructure layers. Domain entities may contain organizationId, but isolation logic is handled by repositories and application services.

#### Scenario: Organization-scoped Workflows

**Given** two organizations: OrgA and OrgB  
**And** OrgA has a workflow definition "SalesProcess"  
**When** a user from OrgB queries workflows  
**Then** they SHALL NOT see OrgA's "SalesProcess" workflow  
**And** they SHALL only see workflows for their organization  
**And** repository implementations SHALL enforce organization filtering

#### Scenario: Cross-organization Entity Access

**Given** OrgA has a workflow instance for entity "opp-123"  
**When** a user from OrgB attempts to access the workflow instance  
**Then** access SHALL be denied  
**And** an error SHALL indicate organization mismatch  
**And** application services SHALL validate organization context before domain operations

### Requirement: Integration with Entity Lifecycle

Workflow execution SHALL integrate with entity state management.

**Architecture Note**: Entity state updates are coordinated by application services. The workflow context publishes domain events that other contexts can subscribe to for entity synchronization.

#### Scenario: Entity State Synchronization

**Given** an Opportunity entity with state field  
**And** a WorkflowInstance exists for this entity  
**When** a workflow transition occurs  
**Then** the entity's state field SHALL be updated to match the workflow state  
**And** the entity update SHALL be persisted  
**And** entity update events SHALL be triggered (for audit logs, notifications, etc.)  
**And** synchronization SHALL be handled by application services coordinating with entity updater interfaces

#### Scenario: Workflow-aware Entity Queries

**Given** entities with associated workflow instances  
**When** a user queries entities  
**Then** the response SHALL optionally include workflow context:
- Current workflow state
- Available transitions
- Workflow status  
**And** workflow context SHALL be enriched by application services querying workflow repositories

### Requirement: API Endpoints

The system SHALL provide REST API endpoints for workflow operations.

**Architecture Note**: Controllers are thin HTTP adapters that parse requests, call application services, and format responses. All business logic resides in application and domain layers.

#### Scenario: Start Workflow

**Given** a WorkflowDefinition with id "wf-123"  
**When** a user sends `POST /api/workflows/wf-123/start` with body `{ entityType: "Opportunity", entityId: "opp-456" }`  
**Then** a WorkflowInstance SHALL be created  
**And** the API SHALL return the instance details  
**And** the response SHALL include current state and available transitions  
**And** the controller SHALL delegate to application services (no business logic in controller)

#### Scenario: Execute Transition

**Given** a WorkflowInstance with id "inst-789"  
**When** a user sends `POST /api/workflows/instances/inst-789/transition` with body `{ toState: "qualified" }`  
**Then** the transition SHALL be executed  
**And** the API SHALL return the updated instance  
**And** the response SHALL include the new state and history entry  
**And** the controller SHALL delegate to application services

#### Scenario: Query Instance Status

**Given** a WorkflowInstance exists  
**When** a user sends `GET /api/workflows/instances/inst-789`  
**Then** the API SHALL return:
- Current state
- Available transitions
- Workflow status
- Start/completion timestamps
- Entity reference  
**And** the controller SHALL delegate to application services

### Requirement: Frontend Workflow Management

The system SHALL provide UI for workflow management and visualization.

**Architecture Note**: Frontend interacts with the same HTTP API endpoints. No changes to frontend are required, as API contracts remain unchanged.

#### Scenario: View Workflow Definition

**Given** a WorkflowDefinition exists  
**When** a user navigates to `/admin/workflows/:id`  
**Then** they SHALL see:
- Workflow name and description
- State diagram visualization
- List of transitions
- Entity type association
- Version and status  
**And** the UI SHALL work identically to before refactoring

#### Scenario: Execute Transition from UI

**Given** a WorkflowInstance exists for an entity  
**And** the entity detail page is displayed  
**When** the user clicks a transition button (e.g., "Move to Qualified")  
**Then** the transition SHALL be executed via API  
**And** the UI SHALL update to show the new state  
**And** the available transitions SHALL be updated  
**And** a success notification SHALL be displayed  
**And** the UI SHALL work identically to before refactoring

#### Scenario: View Workflow History

**Given** a WorkflowInstance with history  
**When** a user views the workflow instance details  
**Then** they SHALL see a timeline of all transitions  
**And** each entry SHALL show:
- From/to states
- Timestamp
- User who triggered it
- Guard condition results (if any)  
**And** the UI SHALL work identically to before refactoring

## ADDED Requirements

### Requirement: Domain-Driven Design Architecture

The workflow module SHALL follow Domain-Driven Design (DDD) architecture principles with clear separation between domain, application, and infrastructure layers.

**Architecture Note**: This requirement defines the structural organization of the workflow module. Behavior remains unchanged; only internal organization changes.

#### Scenario: Domain Layer Independence

**Given** the workflow module  
**When** domain entities and domain services are examined  
**Then** they SHALL have no dependencies on infrastructure (databases, HTTP, external APIs)  
**And** they SHALL contain pure business logic  
**And** they SHALL be testable without setting up databases or external services

#### Scenario: Application Layer Orchestration

**Given** a workflow use case (e.g., start workflow instance)  
**When** the use case is executed  
**Then** application services SHALL orchestrate domain objects  
**And** application services SHALL depend on repository interfaces (not implementations)  
**And** application services SHALL publish domain events  
**And** application services SHALL NOT contain business rules (rules are in domain layer)

#### Scenario: Infrastructure Layer Implementation

**Given** repository interfaces defined in domain/application layers  
**When** persistence is required  
**Then** infrastructure repositories SHALL implement these interfaces  
**And** infrastructure repositories SHALL use TypeORM for database operations  
**And** infrastructure repositories SHALL map between domain entities and database models

#### Scenario: External Service Abstraction

**Given** external services (e.g., AI guard evaluation, AI suggestions)  
**When** these services are used  
**Then** interfaces SHALL be defined in domain/application layers  
**And** implementations SHALL be in infrastructure layer  
**And** application services SHALL depend on interfaces (not concrete implementations)

#### Scenario: Domain Events

**Given** significant business events occur (workflow started, transition executed, workflow completed)  
**When** these events occur  
**Then** domain events SHALL be published  
**And** events SHALL be handled by infrastructure event bus  
**And** events SHALL enable decoupling between workflow context and other contexts
