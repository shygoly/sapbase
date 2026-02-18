# Workflow Engine Design

## Architecture Overview

The workflow engine is designed as a modular system that integrates with existing module definitions and entity lifecycle management.

### Core Components

1. **Workflow Definition**: Stores workflow schemas (states, transitions, guards)
2. **Workflow Instance**: Tracks active workflow executions for entities
3. **Transition Engine**: Validates and executes state transitions
4. **History Service**: Records all workflow events for audit and debugging

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

### Execution Flow

```
1. User/System triggers transition
   ↓
2. Transition Engine validates:
   - Current state matches "from" state
   - Guard conditions pass (if any)
   - User has permission
   ↓
3. Execute transition:
   - Update entity state field
   - Update workflow instance currentState
   - Execute action hooks (if any)
   ↓
4. Record history entry
   ↓
5. Check if final state reached
   ↓
6. Notify subscribers (events, webhooks)
```

### Integration Points

1. **Entity Services**: Workflow engine hooks into entity update operations
2. **Module Registry**: Workflows are associated with modules via entityType
3. **State Machine Definitions**: Workflows can be auto-generated from `step3_stateFlow`
4. **Permissions**: Integration with RBAC for transition permissions

### Technical Decisions

1. **State Storage**: Entity state stored in entity table + workflow instance for workflow metadata
2. **Transition Validation**: Synchronous validation, async execution optional
3. **Guard Conditions**: JavaScript expressions evaluated in sandboxed context
4. **Action Hooks**: Plugin system for custom transition actions
5. **Multi-tenancy**: All workflow data scoped by organizationId

### Performance Considerations

- Cache workflow definitions (Redis)
- Batch history writes for high-volume transitions
- Index on (entityType, entityId) for fast instance lookup
- Lazy loading of workflow context

### Security

- Guard conditions run in sandboxed environment
- Transition permissions checked via RBAC
- Workflow history immutable (append-only)
- Organization-level data isolation

## Frontend UI Components

### Component Architecture

The workflow UI consists of several specialized components:

1. **WorkflowDefinitionEditor** - Visual editor for creating/editing workflow definitions
2. **WorkflowStateDiagram** - Interactive state machine visualization
3. **WorkflowInstanceViewer** - Display workflow instance status and context
4. **WorkflowTransitionButtons** - Action buttons for state transitions
5. **WorkflowHistoryTimeline** - Chronological history visualization
6. **WorkflowInstanceList** - Table/list view of workflow instances

### Technology Stack

**Base UI Library**: shadcn/ui (already in project)
- Card, Button, Badge, Dialog, Tabs, Table, etc.

**State Diagram Visualization**: 
- Option A: `react-flow` (recommended) - Interactive node-based diagrams
- Option B: `mermaid` - Text-to-diagram, simpler but less interactive
- Option C: Custom SVG-based component using D3.js

**Timeline Component**:
- Custom component using shadcn/ui Card + Timeline pattern
- Or `@radix-ui/react-separator` for timeline lines

**Data Visualization**:
- `recharts` (already installed) - For workflow analytics/metrics

### Component Specifications

#### WorkflowStateDiagram Component

**Purpose**: Visualize workflow states and transitions as an interactive diagram

**Features**:
- Nodes represent states (initial, final, regular)
- Edges represent transitions
- Highlight current state in active instances
- Click nodes to view state details
- Click edges to view transition rules
- Zoom and pan support
- Export as image/SVG

**Props**:
```typescript
interface WorkflowStateDiagramProps {
  workflow: WorkflowDefinition
  currentState?: string  // For highlighting active state
  onStateClick?: (state: string) => void
  onTransitionClick?: (transition: Transition) => void
  interactive?: boolean
}
```

#### WorkflowTransitionButtons Component

**Purpose**: Display available transitions as action buttons

**Features**:
- Show only transitions available from current state
- Disable buttons if guard conditions fail
- Show tooltips with guard condition explanations
- Loading states during transition execution
- Success/error feedback

**Props**:
```typescript
interface WorkflowTransitionButtonsProps {
  instance: WorkflowInstance
  availableTransitions: Transition[]
  onTransition: (toState: string) => Promise<void>
  disabled?: boolean
}
```

#### WorkflowHistoryTimeline Component

**Purpose**: Display workflow execution history chronologically

**Features**:
- Vertical timeline layout
- Show state changes with timestamps
- Display user who triggered transition
- Show guard condition results
- Expandable details for each event
- Filter by date range, user, state

**Props**:
```typescript
interface WorkflowHistoryTimelineProps {
  history: WorkflowHistory[]
  compact?: boolean
  onEventClick?: (event: WorkflowHistory) => void
}
```

#### WorkflowInstanceViewer Component

**Purpose**: Display workflow instance details and current status

**Features**:
- Current state badge
- Available transitions
- Workflow context/variables
- Entity reference link
- Status indicators (running, completed, failed)
- Start/completion timestamps

**Props**:
```typescript
interface WorkflowInstanceViewerProps {
  instance: WorkflowInstance
  workflow: WorkflowDefinition
  entity?: Entity  // Optional entity data
  onTransition?: (toState: string) => void
}
```
