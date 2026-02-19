# AI Module DDD Architecture Design

## Context

The AI module currently has ~15 files in a flat structure:
- Entities: `ai-module.entity.ts`, `ai-module-test.entity.ts`, `ai-module-review.entity.ts`, `ai-module-definition.entity.ts`
- Services: `ai-modules.service.ts` (create, publish, review, generatePatch, registerModule, runTests, etc.)
- Controllers: `ai-modules.controller.ts`
- Infrastructure: AI API calls, ModuleRegistry integration, Workflow integration

Business logic is mixed with:
- Database operations (TypeORM repositories)
- External API calls (AI models, ModuleRegistry, Workflow)
- HTTP request handling (controllers)
- Complex orchestration (patch generation, workflow conversion, module registration)

## Goals

1. **Separate concerns**: Domain logic independent of infrastructure
2. **Testability**: Domain logic testable without databases/HTTP/external services
3. **Maintainability**: Clear boundaries for where code belongs
4. **Technology independence**: Can swap implementations without changing business logic
5. **Preserve behavior**: All existing functionality works identically after refactoring

## Non-Goals

- Changing AI module features or behavior
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

### Decision 2: Repository Pattern

**Chosen**: Repository interfaces in domain/application, implementations in infrastructure

**Rationale**:
- Domain entities don't know about database
- Application services depend on abstractions, not concrete implementations
- Easy to swap database implementations or add caching

### Decision 3: Domain Events

**Chosen**: Publish domain events for significant business events

**Rationale**:
- Decouples AI module context from other contexts (e.g., audit logs, notifications)
- Enables future event-driven features
- Makes business events explicit

**Events to add**:
- `ModuleCreatedEvent`
- `ModulePublishedEvent`
- `ModuleUnpublishedEvent`
- `ReviewSubmittedEvent`
- `PatchGeneratedEvent`
- `ModuleRegisteredEvent`
- `TestRunCompletedEvent`

**Implementation**: Reuse event bus from OrganizationContext or AuthContext

### Decision 4: Rich Domain Models

**Chosen**: Entities contain business methods, not just data

**Rationale**:
- Business rules encapsulated in entities (e.g., `module.publish()`, `module.submitReview()`)
- Easier to understand what entities can do
- Prevents invalid states

**Example**:
```typescript
// Before (anemic)
class AIModule {
  status: AIModuleStatus
  // No methods, just data
}

// After (rich)
class AIModule {
  private status: AIModuleStatus
  
  publish(): void {
    if (this.status !== AIModuleStatus.APPROVED) {
      throw new BusinessRuleViolation('Only approved modules can be published')
    }
    this.status = AIModuleStatus.PUBLISHED
    this.publishedAt = new Date()
  }
}
```

### Decision 5: Application Services for Use Cases

**Chosen**: One application service method per use case

**Rationale**:
- Clear mapping: "publish module" → `PublishModuleService.execute()`
- Easy to find where use cases are implemented
- Can add CQRS commands/queries later if needed

**Application Services**:
- `CreateModuleService` - Create new AI module
- `PublishModuleService` - Publish module (must be approved)
- `UnpublishModuleService` - Unpublish module
- `SubmitReviewService` - Submit review (approve/reject)
- `GeneratePatchService` - Generate patch using AI
- `RegisterModuleService` - Register module in ModuleRegistry
- `RunTestsService` - Run module tests
- `UpdateModuleService` - Update module details
- `GetModuleService` - Get module with relations

### Decision 6: External Services as Interfaces

**Chosen**: AI, ModuleRegistry, Workflow services defined as interfaces, implemented in infrastructure

**Rationale**:
- Domain/application don't depend on specific providers
- Can swap AI providers, workflow engines, module registries without changing business logic
- Easy to mock for testing

**Example**:
```typescript
// domain/services/i-ai-model-service.ts
export interface IAIModelService {
  findDefault(): Promise<AIModel | null>
  generatePatch(prompt: string, context?: string): Promise<Record<string, any>>
}

// domain/services/i-module-registry-service.ts
export interface IModuleRegistryService {
  registerModule(module: AIModule): Promise<void>
  unregisterModule(moduleId: string): Promise<void>
}

// domain/services/i-workflow-service.ts
export interface IWorkflowService {
  getWorkflowContext(entityType: string, entityId: string, organizationId: string): Promise<string | null>
}
```

### Decision 7: Value Objects

**Chosen**: Extract common concepts as value objects

**Value Objects**:
- `ModuleVersion` - Version string validation
- `PatchContent` - Patch DSL structure validation
- `ModuleStatus` - Status enum (already exists, keep as enum)

### Decision 8: Domain Services

**Chosen**: Pure business logic services (no I/O)

**Domain Services**:
- `StatusTransitionValidator` - Validate status transitions (pure function)
- `PatchNormalizer` - Normalize patch content (pure function)

### Decision 9: Mapping Strategy

**Chosen**: Keep existing TypeORM entities in `ai-modules/`, map in infrastructure repositories

**Rationale**:
- No database schema changes needed
- Existing entities can coexist with domain entities
- Infrastructure repositories handle mapping between domain and TypeORM entities

## Directory Structure

```
backend/src/ai-module-context/
├── domain/
│   ├── entities/
│   │   ├── ai-module.entity.ts
│   │   ├── ai-module-test.entity.ts
│   │   ├── ai-module-review.entity.ts
│   │   └── ai-module-definition.entity.ts
│   ├── value-objects/
│   │   ├── module-version.vo.ts
│   │   ├── patch-content.vo.ts
│   │   └── index.ts
│   ├── domain-services/
│   │   ├── status-transition-validator.service.ts
│   │   ├── patch-normalizer.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── module-created.event.ts
│   │   ├── module-published.event.ts
│   │   ├── module-unpublished.event.ts
│   │   ├── review-submitted.event.ts
│   │   ├── patch-generated.event.ts
│   │   ├── module-registered.event.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── i-ai-module.repository.ts
│   │   ├── i-ai-module-test.repository.ts
│   │   ├── i-ai-module-review.repository.ts
│   │   └── tokens.ts
│   ├── services/
│   │   ├── i-ai-model-service.ts
│   │   ├── i-module-registry-service.ts
│   │   ├── i-workflow-service.ts
│   │   └── tokens.ts
│   ├── errors/
│   │   ├── domain-error.ts
│   │   ├── business-rule-violation.ts
│   │   └── index.ts
│   └── index.ts
├── application/
│   └── services/
│       ├── create-module.service.ts
│       ├── publish-module.service.ts
│       ├── unpublish-module.service.ts
│       ├── submit-review.service.ts
│       ├── generate-patch.service.ts
│       ├── register-module.service.ts
│       ├── run-tests.service.ts
│       ├── update-module.service.ts
│       ├── get-module.service.ts
│       └── index.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── ai-module.repository.ts
│   │   ├── ai-module-test.repository.ts
│   │   ├── ai-module-review.repository.ts
│   │   └── index.ts
│   ├── external/
│   │   ├── ai-model.service.ts
│   │   ├── module-registry.service.ts
│   │   ├── workflow.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── event-bus.service.ts (reuse from other contexts)
│   │   └── index.ts
│   └── index.ts
└── ai-module-context.module.ts
```

## Migration Steps

1. Create DDD directory structure
2. Create domain entities with business methods
3. Create value objects and domain services
4. Create domain events
5. Create repository interfaces
6. Create external service interfaces (AI, ModuleRegistry, Workflow)
7. Create application services
8. Create infrastructure repositories (map domain ↔ TypeORM)
9. Create infrastructure external services (AI, ModuleRegistry, Workflow)
10. Update controllers to use application services
11. Update module registration
12. Add tests
13. Remove old code
