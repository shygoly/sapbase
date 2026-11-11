# Workflow DDD Architecture Design

## Context

The workflow module currently has ~15 files in a flat structure:
- Entities: `workflow-definition.entity.ts`, `workflow-instance.entity.ts`, `workflow-history.entity.ts`
- Services: `workflow-definition.service.ts`, `workflow-instance.service.ts`, `transition-engine.service.ts`, `workflow-history.service.ts`, `workflow-guard-ai.service.ts`, `workflow-suggestion.service.ts`
- Controllers: `workflows.controller.ts`
- Infrastructure: `workflow-auto-transition.job.ts`, `entity-state-updater.registry.ts`

Business logic is mixed with:
- Database operations (TypeORM repositories)
- External API calls (AI services)
- HTTP request handling (controllers)
- Job scheduling (cron jobs)

## Goals

1. **Separate concerns**: Domain logic independent of infrastructure
2. **Testability**: Domain logic testable without databases/HTTP/external services
3. **Maintainability**: Clear boundaries for where code belongs
4. **Technology independence**: Can swap implementations without changing business logic
5. **Preserve behavior**: All existing functionality works identically after refactoring

## Non-Goals

- Changing workflow engine features or behavior
- Optimizing performance (can be done separately)
- Refactoring other modules
- Changing database schema or HTTP API contracts

## Architecture Decisions

### Decision 1: Three-Layer Structure

**Chosen**: Domain → Application → Infrastructure

**Rationale**:
- Standard DDD pattern that provides clear separation
- Domain layer has no dependencies (pure business logic)
- Application layer orchestrates domain objects
- Infrastructure layer implements technical details

**Alternatives considered**:
- Two-layer (domain + infrastructure): Too simplistic, loses use case clarity
- Four-layer (domain + application + infrastructure + presentation): Overkill for this module

### Decision 2: Repository Pattern

**Chosen**: Repository interfaces in domain/application, implementations in infrastructure

**Rationale**:
- Domain entities don't know about database
- Application services depend on abstractions, not concrete implementations
- Easy to swap database implementations or add caching

**Example**:
```typescript
// domain/repositories/i-workflow-instance.repository.ts (interface)
export interface IWorkflowInstanceRepository {
  save(instance: WorkflowInstance): Promise<void>
  findById(id: string, organizationId: string): Promise<WorkflowInstance | null>
}

// infrastructure/persistence/workflow-instance.repository.ts (implementation)
export class WorkflowInstanceRepository implements IWorkflowInstanceRepository {
  // TypeORM implementation
}
```

### Decision 3: Domain Events

**Chosen**: Publish domain events for significant business events

**Rationale**:
- Decouples workflow context from other contexts (e.g., audit logs, notifications)
- Enables future event-driven features
- Makes business events explicit

**Events to add**:
- `WorkflowInstanceStartedEvent`
- `WorkflowTransitionedEvent`
- `WorkflowInstanceCompletedEvent`

**Implementation**: Simple in-memory event bus initially (can be upgraded to message queue later)

### Decision 4: Rich Domain Models

**Chosen**: Entities contain business methods, not just data

**Rationale**:
- Business rules encapsulated in entities (e.g., `workflowDefinition.ensureCanStart()`)
- Easier to understand what entities can do
- Prevents invalid states

**Example**:
```typescript
// Before (anemic)
class WorkflowDefinition {
  status: WorkflowStatus
  // No methods, just data
}

// After (rich)
class WorkflowDefinition {
  private status: WorkflowStatus
  
  activate(): void {
    if (this.states.length === 0) {
      throw new DomainError('Cannot activate workflow with no states')
    }
    this.status = WorkflowStatus.ACTIVE
  }
}
```

### Decision 5: Application Services for Use Cases

**Chosen**: One application service method per use case

**Rationale**:
- Clear mapping: "start workflow instance" → `StartWorkflowInstanceService.execute()`
- Easy to find where use cases are implemented
- Can add CQRS commands/queries later if needed

**Example**:
```typescript
// application/services/start-workflow-instance.service.ts
export class StartWorkflowInstanceService {
  async execute(command: StartWorkflowInstanceCommand): Promise<WorkflowInstance> {
    // Orchestrate domain objects
    // Call repository interfaces
    // Publish events
  }
}
```

### Decision 6: External Services as Interfaces

**Chosen**: AI services (guards, suggestions) defined as interfaces, implemented in infrastructure

**Rationale**:
- Domain/application don't depend on specific AI providers
- Can swap AI providers or add caching without changing business logic
- Easy to mock for testing

**Example**:
```typescript
// domain/services/i-ai-guard-evaluator.ts
export interface IAiGuardEvaluator {
  evaluateGuard(...): Promise<AiGuardResult>
}

// infrastructure/external/ai-guard-evaluator.service.ts
export class AiGuardEvaluator implements IAiGuardEvaluator {
  // Calls actual AI API
}
```

## Directory Structure

```
workflow-context/
├── domain/
│   ├── entities/
│   │   ├── workflow-definition.entity.ts      (rich domain model)
│   │   ├── workflow-instance.entity.ts        (rich domain model)
│   │   └── workflow-history.entity.ts        (value object or entity)
│   ├── value-objects/
│   │   ├── workflow-state.vo.ts
│   │   └── workflow-transition.vo.ts
│   ├── domain-services/
│   │   └── transition-validator.service.ts    (pure business logic)
│   ├── events/
│   │   ├── workflow-instance-started.event.ts
│   │   ├── workflow-transitioned.event.ts
│   │   └── workflow-instance-completed.event.ts
│   └── repositories/                          (interfaces only)
│       ├── i-workflow-definition.repository.ts
│       └── i-workflow-instance.repository.ts
│
├── application/
│   ├── services/
│   │   ├── start-workflow-instance.service.ts
│   │   ├── execute-transition.service.ts
│   │   ├── get-workflow-instance.service.ts
│   │   └── get-suggested-transitions.service.ts
│   ├── commands/                              (optional, for CQRS)
│   │   ├── start-workflow-instance.command.ts
│   │   └── execute-transition.command.ts
│   └── queries/
│       └── get-workflow-instance.query.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── workflow-definition.repository.ts  (TypeORM implementation)
    │   └── workflow-instance.repository.ts
    ├── http/
    │   └── workflows.controller.ts            (thin HTTP adapter)
    ├── external/
    │   ├── ai-guard-evaluator.service.ts      (AI API client)
    │   └── ai-suggestion.service.ts
    ├── events/
    │   └── event-bus.service.ts               (event bus implementation)
    └── jobs/
        └── workflow-auto-transition.job.ts    (cron job)
```

## Dependency Flow

```
Infrastructure → Application → Domain
     ↓              ↓            ↓
  (depends on)  (depends on)  (no dependencies)
```

- Domain: No dependencies (pure TypeScript)
- Application: Depends on Domain + Repository interfaces + Event interfaces
- Infrastructure: Depends on Application + Domain (implements interfaces)

## Migration Plan

### Phase 1: Create Structure (Parallel)
- Create new directory structure
- Copy existing entities to domain/entities (keep old files)
- Create repository interfaces
- Create event definitions

### Phase 2: Enrich Domain Models
- Add business methods to entities
- Extract domain services from existing services
- Add domain events

### Phase 3: Create Application Services
- Extract use case logic from existing services
- Create application service classes
- Wire up repository interfaces

### Phase 4: Implement Infrastructure
- Create repository implementations
- Refactor controllers to thin adapters
- Implement external service adapters
- Implement event bus

### Phase 5: Update Module Registration
- Update WorkflowsModule to use new structure
- Register new services
- Remove old service registrations

### Phase 6: Remove Old Code
- Delete old service files
- Update imports
- Run tests

## Risks / Trade-offs

### Risk: Large Refactoring Scope
**Mitigation**: Incremental migration, keep old code working until new code is complete

### Risk: Breaking Changes
**Mitigation**: Preserve HTTP API contracts, only change internal structure

### Risk: Team Confusion
**Mitigation**: Clear documentation, gradual rollout, training on DDD concepts

### Trade-off: More Files, More Structure
**Benefit**: Clearer organization, easier to find code
**Cost**: More files to navigate initially

### Trade-off: More Abstraction Layers
**Benefit**: Testability, flexibility
**Cost**: More indirection, slightly more complex

## Open Questions

1. Should we use CQRS pattern (commands/queries) or keep simple application services?
   - **Decision**: Start with simple application services, can add CQRS later if needed

2. Should domain events be synchronous or asynchronous?
   - **Decision**: Start synchronous (in-memory), can add async later

3. Should we use a dependency injection container for domain services?
   - **Decision**: No, domain services are stateless, can be instantiated directly

4. How to handle cross-context dependencies (e.g., workflow needs user info)?
   - **Decision**: Use events or query interfaces, avoid direct entity imports
