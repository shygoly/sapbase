# Implementation Tasks

## Phase 1: Core Workflow Engine

- [x] Create workflow entities (WorkflowDefinition, WorkflowInstance, WorkflowHistory)
- [x] Create workflow module structure (`backend/src/workflows/`)
- [x] Implement WorkflowDefinitionService (CRUD operations)
- [x] Implement WorkflowInstanceService (create, update, query instances)
- [x] Implement TransitionEngine (validate and execute transitions)
- [x] Create workflow controllers (REST API endpoints)
- [x] Add database migrations for workflow tables
- [x] Add workflow module to AppModule

## Phase 2: State Machine Integration

- [x] Create service to convert `step3_stateFlow` to WorkflowDefinition
- [x] Auto-create workflows when AI modules are published
- [x] Add workflow metadata to ModuleRegistry
- [x] Integrate workflow engine with entity update operations
- [x] Add entity state field updates on transition

## Phase 3: Guard Conditions and Actions

- [x] Implement guard condition parser and evaluator
- [ ] Create sandboxed execution environment for guards (future: use vm2/isolated-vm)
- [x] Implement action hook system
- [x] Add predefined actions (notify, update fields, trigger webhooks)
- [ ] Add guard condition validation and testing

## Phase 4: History and Audit

- [x] Implement WorkflowHistoryService
- [x] Record all transitions with metadata
- [x] Add history query endpoints
- [x] Add workflow instance status endpoints
- [ ] Implement history cleanup (optional, configurable retention)

## Phase 5: API and Integration

- [x] Create workflow API client (`speckit/src/lib/api/workflows.api.ts`)
- [x] Add workflow endpoints:
  - [x] `POST /api/workflows/:id/start` - Start workflow for entity
  - [x] `POST /api/workflow-instances/:id/transition` - Execute transition
  - [x] `GET /api/workflows/:id/instances` - List instances
  - [x] `GET /api/workflow-instances/:id` - Get instance details
  - [x] `GET /api/workflow-instances/:id/history` - Get history
- [ ] Add workflow context to entity responses (future enhancement)
- [ ] Add transition permissions integration (future enhancement)

## Phase 6: Frontend UI

- [ ] Install workflow visualization library (`react-flow` or `mermaid`)
- [ ] Create workflow management page (`/admin/workflows`)
- [ ] Create WorkflowDefinitionEditor component
  - [ ] Form for workflow name, description, entity type
  - [ ] State management (add/edit/delete states)
  - [ ] Transition management (add/edit/delete transitions)
  - [ ] Guard condition editor
- [ ] Create WorkflowStateDiagram component
  - [ ] Render states as nodes
  - [ ] Render transitions as edges
  - [ ] Interactive node/edge selection
  - [ ] Highlight current state
  - [ ] Zoom and pan controls
- [ ] Create WorkflowInstanceViewer component
  - [ ] Display current state and status
  - [ ] Show workflow context/variables
  - [ ] Entity reference display
- [ ] Create WorkflowTransitionButtons component
  - [ ] Dynamic button generation from available transitions
  - [ ] Guard condition validation display
  - [ ] Loading and error states
- [ ] Create WorkflowHistoryTimeline component
  - [ ] Vertical timeline layout
  - [ ] Event cards with details
  - [ ] Filter and search functionality
- [ ] Create WorkflowInstanceList component
  - [ ] Table view with sorting/filtering
  - [ ] Status badges
  - [ ] Quick actions
- [ ] Integrate workflow UI into entity detail pages
- [ ] Add workflow context to entity list views

## Phase 7: Testing and Documentation

- [ ] Unit tests for TransitionEngine
- [ ] Unit tests for guard condition evaluator
- [ ] Integration tests for workflow lifecycle
- [ ] E2E tests for workflow execution
- [ ] API documentation (Swagger)
- [ ] User documentation (workflow definition guide)

## Phase 8: Performance and Optimization

- [x] Add Redis caching for workflow definitions
- [x] Optimize database queries (indexes, joins)
- [ ] Add workflow instance pagination
- [ ] Implement batch history writes
- [ ] Add workflow execution metrics
