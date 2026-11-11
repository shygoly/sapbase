# Workflow Engine Specification

## ADDED Requirements

### Requirement: Workflow Definition Management

The system SHALL allow users to define workflows that specify states and transitions for entities.

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

#### Scenario: Auto-generate Workflow from State Flow

**Given** an AI module with `step3_stateFlow` definition containing state machine data  
**When** the module is published  
**Then** a WorkflowDefinition SHALL be automatically created from the state flow  
**And** the workflow SHALL be linked to the module via ModuleRegistry  
**And** the workflow SHALL use the entity types defined in the module

### Requirement: Workflow Instance Management

The system SHALL create and manage workflow instances for entities.

#### Scenario: Start Workflow for Entity

**Given** a WorkflowDefinition exists for entity type "Opportunity"  
**And** an Opportunity entity exists with id "opp-123"  
**When** a user starts the workflow for this entity  
**Then** a WorkflowInstance SHALL be created  
**And** the instance SHALL be in the initial state  
**And** the instance SHALL reference the entity (entityType="Opportunity", entityId="opp-123")  
**And** the instance SHALL record who started it and when

#### Scenario: Query Workflow Instance

**Given** a WorkflowInstance exists for an entity  
**When** a user queries the workflow instance by entity  
**Then** the system SHALL return:
- Current state
- Available transitions
- Workflow status (running, completed, failed)
- Start and completion timestamps

### Requirement: State Transition Execution

The system SHALL execute state transitions with validation and guard conditions.

#### Scenario: Execute Valid Transition

**Given** a WorkflowInstance in state "draft"  
**And** a transition exists from "draft" to "qualified"  
**And** the user has permission to execute the transition  
**When** the user triggers the transition  
**Then** the workflow instance SHALL move to state "qualified"  
**And** the entity's state field SHALL be updated to "qualified"  
**And** a history entry SHALL be recorded  
**And** the transition SHALL complete successfully

#### Scenario: Reject Invalid Transition

**Given** a WorkflowInstance in state "draft"  
**And** no transition exists from "draft" to "won"  
**When** a user attempts to transition directly to "won"  
**Then** the transition SHALL be rejected  
**And** an error SHALL be returned indicating invalid transition  
**And** the workflow state SHALL remain unchanged

#### Scenario: Guard Condition Enforcement

**Given** a WorkflowInstance in state "qualified"  
**And** a transition from "qualified" to "won" exists with guard condition: `entity.value >= 10000`  
**And** the entity value is 5000  
**When** a user attempts to transition to "won"  
**Then** the guard condition SHALL be evaluated  
**And** the transition SHALL be rejected  
**And** an error SHALL indicate the guard condition failed  
**And** the workflow state SHALL remain unchanged

### Requirement: Workflow History

The system SHALL record all workflow events for audit and debugging.

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

#### Scenario: Query Workflow History

**Given** a WorkflowInstance with multiple transitions  
**When** a user queries the workflow history  
**Then** the system SHALL return all history entries in chronological order  
**And** each entry SHALL include all transition details  
**And** the history SHALL be paginated for large datasets

### Requirement: Multi-tenant Isolation

Workflow definitions and instances SHALL be isolated by organization.

#### Scenario: Organization-scoped Workflows

**Given** two organizations: OrgA and OrgB  
**And** OrgA has a workflow definition "SalesProcess"  
**When** a user from OrgB queries workflows  
**Then** they SHALL NOT see OrgA's "SalesProcess" workflow  
**And** they SHALL only see workflows for their organization

#### Scenario: Cross-organization Entity Access

**Given** OrgA has a workflow instance for entity "opp-123"  
**When** a user from OrgB attempts to access the workflow instance  
**Then** access SHALL be denied  
**And** an error SHALL indicate organization mismatch

### Requirement: Integration with Entity Lifecycle

Workflow execution SHALL integrate with entity state management.

#### Scenario: Entity State Synchronization

**Given** an Opportunity entity with state field  
**And** a WorkflowInstance exists for this entity  
**When** a workflow transition occurs  
**Then** the entity's state field SHALL be updated to match the workflow state  
**And** the entity update SHALL be persisted  
**And** entity update events SHALL be triggered (for audit logs, notifications, etc.)

#### Scenario: Workflow-aware Entity Queries

**Given** entities with associated workflow instances  
**When** a user queries entities  
**Then** the response SHALL optionally include workflow context:
- Current workflow state
- Available transitions
- Workflow status

### Requirement: API Endpoints

The system SHALL provide REST API endpoints for workflow operations.

#### Scenario: Start Workflow

**Given** a WorkflowDefinition with id "wf-123"  
**When** a user sends `POST /api/workflows/wf-123/start` with body `{ entityType: "Opportunity", entityId: "opp-456" }`  
**Then** a WorkflowInstance SHALL be created  
**And** the API SHALL return the instance details  
**And** the response SHALL include current state and available transitions

#### Scenario: Execute Transition

**Given** a WorkflowInstance with id "inst-789"  
**When** a user sends `POST /api/workflows/instances/inst-789/transition` with body `{ toState: "qualified" }`  
**Then** the transition SHALL be executed  
**And** the API SHALL return the updated instance  
**And** the response SHALL include the new state and history entry

#### Scenario: Query Instance Status

**Given** a WorkflowInstance exists  
**When** a user sends `GET /api/workflows/instances/inst-789`  
**Then** the API SHALL return:
- Current state
- Available transitions
- Workflow status
- Start/completion timestamps
- Entity reference

### Requirement: Frontend Workflow Management

The system SHALL provide UI for workflow management and visualization.

#### Scenario: View Workflow Definition

**Given** a WorkflowDefinition exists  
**When** a user navigates to `/admin/workflows/:id`  
**Then** they SHALL see:
- Workflow name and description
- State diagram visualization
- List of transitions
- Entity type association
- Version and status

#### Scenario: Execute Transition from UI

**Given** a WorkflowInstance exists for an entity  
**And** the entity detail page is displayed  
**When** the user clicks a transition button (e.g., "Move to Qualified")  
**Then** the transition SHALL be executed via API  
**And** the UI SHALL update to show the new state  
**And** the available transitions SHALL be updated  
**And** a success notification SHALL be displayed

#### Scenario: View Workflow History

**Given** a WorkflowInstance with history  
**When** a user views the workflow instance details  
**Then** they SHALL see a timeline of all transitions  
**And** each entry SHALL show:
- From/to states
- Timestamp
- User who triggered it
- Guard condition results (if any)

## MODIFIED Requirements

### Requirement: Module Registry Integration

The ModuleRegistry SHALL include workflow execution metadata.

#### Scenario: Link Workflow to Module

**Given** a ModuleRegistry entry for a module  
**And** a WorkflowDefinition exists for entities in that module  
**When** the module is registered  
**Then** the ModuleRegistry SHALL reference the WorkflowDefinition  
**And** the module capabilities SHALL include workflow execution capability
