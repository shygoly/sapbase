# Workflow Engine

A state machine execution engine for managing entity workflows.

## Features

- **Workflow Definitions**: Define state machines with states, transitions, and guard conditions
- **Workflow Instances**: Track workflow execution for entities
- **State Transitions**: Execute validated state transitions with guard condition evaluation
- **History & Audit**: Complete audit trail of all workflow executions
- **AI Module Integration**: Auto-generate workflows from AI module `step3_stateFlow` definitions
- **Multi-tenant**: Full organization-level data isolation

## Architecture

### Core Components

1. **WorkflowDefinition**: Stores workflow schemas (states, transitions, guards)
2. **WorkflowInstance**: Tracks active workflow executions for entities
3. **TransitionEngine**: Validates and executes state transitions
4. **WorkflowHistory**: Records all workflow events for audit

### Data Model

```
WorkflowDefinition
├── id, organizationId, name, description
├── entityType (e.g., "Opportunity", "Lead")
├── states: [{ name, initial, final, metadata }]
├── transitions: [{ from, to, guard, action, metadata }]
└── version, status, createdAt, updatedAt

WorkflowInstance
├── id, organizationId, workflowDefinitionId
├── entityType, entityId (e.g., Opportunity.id)
├── currentState
├── context (JSONB for workflow variables)
├── status (running, completed, failed, cancelled)
└── startedAt, completedAt, startedBy

WorkflowHistory
├── id, workflowInstanceId
├── fromState, toState
├── triggeredBy (user or system)
├── timestamp, metadata
└── guardResult, actionResult
```

## API Endpoints

### Workflow Definitions

- `POST /api/workflows` - Create workflow definition
- `GET /api/workflows` - List workflows (optionally filter by entityType)
- `GET /api/workflows/:id` - Get workflow definition
- `PATCH /api/workflows/:id` - Update workflow definition
- `DELETE /api/workflows/:id` - Delete workflow definition

### Workflow Instances

- `POST /api/workflows/:id/start` - Start workflow for entity
- `GET /api/workflow-instances` - List instances (with filters)
- `GET /api/workflow-instances/:id` - Get instance details with available transitions
- `POST /api/workflow-instances/:id/transition` - Execute state transition
- `POST /api/workflow-instances/:id/cancel` - Cancel workflow instance
- `GET /api/workflow-instances/:id/history` - Get workflow history

## Usage Examples

### Creating a Workflow Definition

```typescript
const workflow = await workflowDefinitionService.create({
  name: 'Opportunity Workflow',
  description: 'Sales opportunity state machine',
  entityType: 'Opportunity',
  states: [
    { name: 'new', initial: true },
    { name: 'qualified', initial: false },
    { name: 'proposal', initial: false },
    { name: 'won', final: true },
    { name: 'lost', final: true },
  ],
  transitions: [
    { from: 'new', to: 'qualified' },
    { from: 'qualified', to: 'proposal' },
    { from: 'proposal', to: 'won' },
    { from: 'proposal', to: 'lost' },
  ],
}, organizationId)
```

### Starting a Workflow Instance

```typescript
const instance = await workflowInstanceService.create({
  workflowDefinitionId: workflow.id,
  entityType: 'Opportunity',
  entityId: 'opp-123',
  context: { source: 'website' },
}, organizationId, userId)
```

### Executing a Transition

```typescript
const result = await transitionEngineService.executeTransition(
  workflow,
  instance,
  'qualified',
  userId,
  entity,
)

if (result.success) {
  await workflowInstanceService.updateState(instance.id, 'qualified', organizationId)
}
```

## Guard Conditions

Guard conditions are JavaScript expressions evaluated before allowing a transition.

### Supported Patterns

- Property access: `entity.field === 'value'`
- Comparisons: `entity.amount > 1000`
- Logical operators: `entity.field === 'A' && context.role === 'admin'`
- Helper functions:
  - `has(entity, 'field')` - Check if property exists
  - `equals(a, b)` - Equality check
  - `isEmpty(value)` - Check if value is empty
  - `contains(str, substr)` - String contains check
  - `Math.max(a, b)` - Math operations

### Example Guard Conditions

```typescript
// Simple comparison
"entity.status === 'active'"

// With logical operators
"entity.amount > 1000 && entity.currency === 'USD'"

// Using helper functions
"has(entity, 'approver') && !isEmpty(entity.approver)"
```

## Actions

Actions are executed after a successful transition. Supported actions:

- `notify` - Send notification
- `updateFields` - Update entity fields
- `triggerWebhook` - Trigger external webhook
- `log` - Log action

### Action Format

```
actionName:param1:param2
```

Or JSON:
```json
{
  "action": "notify",
  "params": {
    "message": "Workflow transitioned to qualified"
  }
}
```

## AI Module Integration

When an AI module with `step3_stateFlow` is published, a workflow is automatically created:

```typescript
// In AIModulesService.publish()
const definition = await this.getDefinition(moduleId)
if (definition?.step3_stateFlow) {
  const workflow = await this.workflowConverterService.createWorkflowFromStateFlow(
    definition.step3_stateFlow,
    entityType,
    module.name,
    organizationId,
  )
  
  // Workflow ID is stored in ModuleRegistry metadata
}
```

## Caching

Workflow definitions are cached in Redis for 5 minutes to improve performance.

## Security

- All operations are scoped by `organizationId`
- Guard conditions run in controlled evaluation context
- Workflow history is immutable (append-only)
- Transition permissions can be integrated with RBAC

## Future Enhancements

- Sandboxed guard condition evaluation (vm2, isolated-vm)
- Action registry system with plugin support
- Workflow versioning and migration
- Sub-workflows and parallel execution
- Workflow analytics and reporting
