# WorkflowContext DDD Structure - Complete File List

This document provides the complete file structure for the refactored WorkflowContext following DDD architecture.

## Target Directory Structure

```
backend/src/workflow-context/
├── domain/
│   ├── entities/
│   │   ├── workflow-definition.entity.ts
│   │   ├── workflow-instance.entity.ts
│   │   └── workflow-history.entity.ts
│   ├── value-objects/
│   │   ├── workflow-state.vo.ts
│   │   ├── workflow-transition.vo.ts
│   │   └── index.ts
│   ├── domain-services/
│   │   ├── transition-validator.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── workflow-instance-started.event.ts
│   │   ├── workflow-transitioned.event.ts
│   │   ├── workflow-instance-completed.event.ts
│   │   ├── workflow-instance-cancelled.event.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── i-workflow-definition.repository.ts
│   │   ├── i-workflow-instance.repository.ts
│   │   ├── i-workflow-history.repository.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── i-ai-guard-evaluator.ts
│   │   ├── i-ai-suggestion.service.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── domain-error.ts
│   │   ├── business-rule-violation.ts
│   │   └── index.ts
│   └── index.ts
│
├── application/
│   ├── services/
│   │   ├── start-workflow-instance.service.ts
│   │   ├── execute-transition.service.ts
│   │   ├── get-workflow-instance.service.ts
│   │   ├── get-suggested-transitions.service.ts
│   │   ├── create-workflow-definition.service.ts
│   │   └── index.ts
│   ├── commands/                          (optional, for CQRS)
│   │   ├── start-workflow-instance.command.ts
│   │   ├── execute-transition.command.ts
│   │   └── index.ts
│   ├── queries/                           (optional, for CQRS)
│   │   ├── get-workflow-instance.query.ts
│   │   └── index.ts
│   └── index.ts
│
├── infrastructure/
│   ├── persistence/
│   │   ├── workflow-definition.repository.ts
│   │   ├── workflow-instance.repository.ts
│   │   ├── workflow-history.repository.ts
│   │   └── index.ts
│   ├── http/
│   │   ├── workflows.controller.ts
│   │   ├── workflow-instances.controller.ts
│   │   └── index.ts
│   ├── external/
│   │   ├── ai-guard-evaluator.service.ts
│   │   ├── ai-suggestion.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── event-bus.service.ts
│   │   ├── i-event-publisher.ts
│   │   └── index.ts
│   ├── jobs/
│   │   ├── workflow-auto-transition.job.ts
│   │   └── index.ts
│   └── index.ts
│
└── workflow-context.module.ts
```

## File Mapping: Current → DDD Structure

### Domain Layer

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `workflow-definition.entity.ts` | `domain/entities/workflow-definition.entity.ts` | Add business methods, remove direct TypeORM usage in business logic |
| `workflow-instance.entity.ts` | `domain/entities/workflow-instance.entity.ts` | Add business methods (`transitionTo()`, `complete()`, `cancel()`) |
| `workflow-history.entity.ts` | `domain/entities/workflow-history.entity.ts` | Keep as entity or convert to value object |
| N/A | `domain/value-objects/workflow-state.vo.ts` | **NEW** - Extract state as value object |
| N/A | `domain/value-objects/workflow-transition.vo.ts` | **NEW** - Extract transition as value object |
| `transition-engine.service.ts` (partial) | `domain/domain-services/transition-validator.service.ts` | Extract pure validation logic, remove infrastructure dependencies |
| N/A | `domain/events/*.event.ts` | **NEW** - Domain events |
| N/A | `domain/repositories/*.repository.ts` | **NEW** - Repository interfaces |
| N/A | `domain/services/i-ai-guard-evaluator.ts` | **NEW** - External service interfaces |
| N/A | `domain/services/i-ai-suggestion.service.ts` | **NEW** - External service interfaces |
| N/A | `domain/errors/*.ts` | **NEW** - Domain-specific errors |

### Application Layer

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `workflow-instance.service.ts` (partial) | `application/services/start-workflow-instance.service.ts` | Extract use case logic, use repository interfaces |
| `transition-engine.service.ts` (partial) | `application/services/execute-transition.service.ts` | Extract orchestration logic, coordinate domain services |
| `workflow-instance.service.ts` (partial) | `application/services/get-workflow-instance.service.ts` | Extract query logic |
| `workflow-suggestion.service.ts` (partial) | `application/services/get-suggested-transitions.service.ts` | Extract orchestration, use AI service interface |
| `workflow-definition.service.ts` (partial) | `application/services/create-workflow-definition.service.ts` | Extract creation logic |
| N/A | `application/commands/*.command.ts` | **NEW** (optional) - Command objects for CQRS |
| N/A | `application/queries/*.query.ts` | **NEW** (optional) - Query objects for CQRS |

### Infrastructure Layer

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `workflow-definition.service.ts` (partial) | `infrastructure/persistence/workflow-definition.repository.ts` | Extract persistence logic, implement repository interface |
| `workflow-instance.service.ts` (partial) | `infrastructure/persistence/workflow-instance.repository.ts` | Extract persistence logic, implement repository interface |
| `workflow-history.service.ts` | `infrastructure/persistence/workflow-history.repository.ts` | Convert to repository implementation |
| `workflows.controller.ts` | `infrastructure/http/workflows.controller.ts` | Thin HTTP adapter, delegate to application services |
| `workflows.controller.ts` (WorkflowInstancesController) | `infrastructure/http/workflow-instances.controller.ts` | Thin HTTP adapter |
| `workflow-guard-ai.service.ts` | `infrastructure/external/ai-guard-evaluator.service.ts` | Implement `IAiGuardEvaluator` interface |
| `workflow-suggestion.service.ts` (partial) | `infrastructure/external/ai-suggestion.service.ts` | Implement `IAiSuggestionService` interface |
| N/A | `infrastructure/events/event-bus.service.ts` | **NEW** - Event bus implementation |
| `workflow-auto-transition.job.ts` | `infrastructure/jobs/workflow-auto-transition.job.ts` | Update to use application services |
| `entity-state-updater.registry.ts` | `infrastructure/external/entity-state-updater.registry.ts` | Keep as infrastructure (cross-context integration) |

## Files to Remove After Migration

- `workflow-definition.service.ts` (replaced by application services + repositories)
- `workflow-instance.service.ts` (replaced by application services + repositories)
- `transition-engine.service.ts` (split into domain service + application service)
- `workflow-history.service.ts` (replaced by repository)
- `workflow-guard-ai.service.ts` (moved to infrastructure)
- `workflow-suggestion.service.ts` (split into application service + infrastructure)

## Key Files with Detailed Structure

### Domain Entity Example

```typescript
// domain/entities/workflow-definition.entity.ts
export class WorkflowDefinition {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    private states: WorkflowState[],
    private transitions: WorkflowTransition[],
    private status: WorkflowStatus,
    public readonly organizationId: string,
  ) {}

  static create(name: string, states: WorkflowState[], transitions: WorkflowTransition[], organizationId: string): WorkflowDefinition {
    // Business rules: validate states and transitions
    // ...
    return new WorkflowDefinition(uuid(), name, states, transitions, WorkflowStatus.DRAFT, organizationId)
  }

  activate(): void {
    // Business rule: cannot activate without states
    if (this.states.length === 0) {
      throw new DomainError('Cannot activate workflow with no states')
    }
    this.status = WorkflowStatus.ACTIVE
  }

  findTransition(fromState: string, toState: string): WorkflowTransition | null {
    return this.transitions.find(t => t.from === fromState && t.to === toState) || null
  }

  getInitialState(): WorkflowState {
    const initial = this.states.find(s => s.initial)
    if (!initial) throw new DomainError('No initial state found')
    return initial
  }
}
```

### Application Service Example

```typescript
// application/services/start-workflow-instance.service.ts
export class StartWorkflowInstanceService {
  constructor(
    private workflowDefinitionRepository: IWorkflowDefinitionRepository,
    private workflowInstanceRepository: IWorkflowInstanceRepository,
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: StartWorkflowInstanceCommand): Promise<WorkflowInstance> {
    // 1. Get workflow definition
    const workflow = await this.workflowDefinitionRepository.findById(
      command.workflowDefinitionId,
      command.organizationId
    )
    if (!workflow) {
      throw new NotFoundError('Workflow definition not found')
    }

    // 2. Domain logic: ensure can start
    workflow.ensureCanStart()

    // 3. Domain logic: check if instance exists
    const existing = await this.workflowInstanceRepository.findRunningInstance(
      command.entityType,
      command.entityId,
      command.workflowDefinitionId,
      command.organizationId
    )
    if (existing) {
      throw new BusinessRuleViolation('Workflow instance already exists')
    }

    // 4. Domain logic: create instance
    const instance = WorkflowInstance.create(
      workflow,
      command.entityType,
      command.entityId,
      command.context,
      command.userId
    )

    // 5. Persist
    await this.workflowInstanceRepository.save(instance)

    // 6. Publish event
    await this.eventPublisher.publish(
      new WorkflowInstanceStartedEvent(
        instance.id,
        workflow.id,
        command.entityType,
        command.entityId
      )
    )

    return instance
  }
}
```

### Infrastructure Repository Example

```typescript
// infrastructure/persistence/workflow-instance.repository.ts
export class WorkflowInstanceRepository implements IWorkflowInstanceRepository {
  constructor(
    @InjectRepository(WorkflowInstance)
    private typeOrmRepository: Repository<WorkflowInstance>,
  ) {}

  async save(instance: WorkflowInstance): Promise<void> {
    await this.typeOrmRepository.save(instance)
  }

  async findById(id: string, organizationId: string): Promise<WorkflowInstance | null> {
    return this.typeOrmRepository.findOne({
      where: { id, organizationId },
      relations: ['workflowDefinition'],
    })
  }

  async findRunningInstance(
    entityType: string,
    entityId: string,
    workflowDefinitionId: string,
    organizationId: string,
  ): Promise<WorkflowInstance | null> {
    return this.typeOrmRepository.findOne({
      where: {
        organizationId,
        entityType,
        entityId,
        workflowDefinitionId,
        status: WorkflowInstanceStatus.RUNNING,
      },
    })
  }
}
```

## Migration Checklist Summary

1. ✅ Create directory structure
2. ✅ Create domain entities with business methods
3. ✅ Create domain services (pure business logic)
4. ✅ Create domain events
5. ✅ Create repository interfaces
6. ✅ Create application services
7. ✅ Create infrastructure repositories
8. ✅ Create infrastructure external services
9. ✅ Refactor controllers to thin adapters
10. ✅ Update module registration
11. ✅ Update tests
12. ✅ Remove old files

See `tasks.md` for detailed step-by-step migration guide.
