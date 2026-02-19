## 1. Create DDD Directory Structure

- [ ] 1.1 Create `ai-module-context/domain/entities/` directory
- [ ] 1.2 Create `ai-module-context/domain/value-objects/` directory
- [ ] 1.3 Create `ai-module-context/domain/domain-services/` directory
- [ ] 1.4 Create `ai-module-context/domain/events/` directory
- [ ] 1.5 Create `ai-module-context/domain/repositories/` directory
- [ ] 1.6 Create `ai-module-context/domain/services/` directory
- [ ] 1.7 Create `ai-module-context/application/services/` directory
- [ ] 1.8 Create `ai-module-context/infrastructure/persistence/` directory
- [ ] 1.9 Create `ai-module-context/infrastructure/external/` directory
- [ ] 1.10 Create `ai-module-context/infrastructure/events/` directory

## 2. Domain Layer: Entities and Value Objects

- [ ] 2.1 Copy `ai-module.entity.ts` to `domain/entities/` and remove TypeORM decorators
- [ ] 2.2 Add business methods to `AIModule`:
  - [ ] `create()` static factory method
  - [ ] `publish()` method (must be approved)
  - [ ] `unpublish()` method
  - [ ] `submitReview(decision, comments, reviewerId)` method
  - [ ] `updatePatch(patchContent)` method
  - [ ] `canBePublished()` method
  - [ ] `canBeReviewed()` method
- [ ] 2.3 Copy `ai-module-test.entity.ts` to `domain/entities/` and enrich
- [ ] 2.4 Copy `ai-module-review.entity.ts` to `domain/entities/` and enrich
- [ ] 2.5 Copy `ai-module-definition.entity.ts` to `domain/entities/` (if needed)
- [ ] 2.6 Create `ModuleVersion` value object
- [ ] 2.7 Create `PatchContent` value object (optional, can stay as Record)
- [ ] 2.8 Create domain error classes (`DomainError`, `BusinessRuleViolation`) - reuse from other contexts

## 3. Domain Layer: Domain Services

- [ ] 3.1 Create `domain/domain-services/status-transition-validator.service.ts` (pure function)
- [ ] 3.2 Create `domain/domain-services/patch-normalizer.service.ts` (pure function)

## 4. Domain Layer: Events

- [ ] 4.1 Create `domain/events/module-created.event.ts`
- [ ] 4.2 Create `domain/events/module-published.event.ts`
- [ ] 4.3 Create `domain/events/module-unpublished.event.ts`
- [ ] 4.4 Create `domain/events/review-submitted.event.ts`
- [ ] 4.5 Create `domain/events/patch-generated.event.ts`
- [ ] 4.6 Create `domain/events/module-registered.event.ts`
- [ ] 4.7 Create `domain/events/test-run-completed.event.ts`
- [ ] 4.8 Reuse event publisher interface from other contexts

## 5. Domain Layer: Repository Interfaces

- [ ] 5.1 Create `domain/repositories/i-ai-module.repository.ts` interface
- [ ] 5.2 Create `domain/repositories/i-ai-module-test.repository.ts` interface
- [ ] 5.3 Create `domain/repositories/i-ai-module-review.repository.ts` interface
- [ ] 5.4 Define methods needed by application layer (save, findById, findAll, etc.)
- [ ] 5.5 Create DI tokens in `domain/repositories/tokens.ts`

## 6. Domain Layer: External Service Interfaces

- [ ] 6.1 Create `domain/services/i-ai-model-service.ts` interface
- [ ] 6.2 Create `domain/services/i-module-registry-service.ts` interface
- [ ] 6.3 Create `domain/services/i-workflow-service.ts` interface
- [ ] 6.4 Create DI tokens in `domain/services/tokens.ts`

## 7. Application Layer: Services

- [ ] 7.1 Create `application/services/create-module.service.ts`:
  - [ ] Extract logic from `AIModulesService.create()`
  - [ ] Use repository interfaces
  - [ ] Call domain entity methods
  - [ ] Publish `ModuleCreatedEvent`
- [ ] 7.2 Create `application/services/publish-module.service.ts`:
  - [ ] Extract logic from `AIModulesService.publish()`
  - [ ] Use domain entity `publish()` method
  - [ ] Use `IModuleRegistryService` to register
  - [ ] Publish `ModulePublishedEvent` and `ModuleRegisteredEvent`
- [ ] 7.3 Create `application/services/unpublish-module.service.ts`:
  - [ ] Extract logic from `AIModulesService.unpublish()`
  - [ ] Use domain entity `unpublish()` method
  - [ ] Use `IModuleRegistryService` to unregister
  - [ ] Publish `ModuleUnpublishedEvent`
- [ ] 7.4 Create `application/services/submit-review.service.ts`:
  - [ ] Extract logic from `AIModulesService.submitReview()`
  - [ ] Use domain entity `submitReview()` method
  - [ ] Publish `ReviewSubmittedEvent`
- [ ] 7.5 Create `application/services/generate-patch.service.ts`:
  - [ ] Extract logic from `AIModulesService.generatePatch()`
  - [ ] Use `IAIModelService` to generate patch
  - [ ] Use `IWorkflowService` to get context
  - [ ] Use domain entity `updatePatch()` method
  - [ ] Publish `PatchGeneratedEvent`
- [ ] 7.6 Create `application/services/register-module.service.ts`:
  - [ ] Extract logic from `AIModulesService.registerModule()`
  - [ ] Use `IModuleRegistryService` to register
  - [ ] Publish `ModuleRegisteredEvent`
- [ ] 7.7 Create `application/services/run-tests.service.ts`:
  - [ ] Extract logic from `AIModulesService.runTests()`
  - [ ] Use repository interfaces
  - [ ] Publish `TestRunCompletedEvent`
- [ ] 7.8 Create `application/services/update-module.service.ts`:
  - [ ] Extract logic from `AIModulesService.update()`
  - [ ] Use repository interfaces
- [ ] 7.9 Create `application/services/get-module.service.ts`:
  - [ ] Extract query logic from `AIModulesService.findOne()`
  - [ ] Use repository interfaces

## 8. Infrastructure Layer: Repositories

- [ ] 8.1 Create `infrastructure/persistence/ai-module.repository.ts`:
  - [ ] Implement `IAIModuleRepository`
  - [ ] Use TypeORM repository internally
  - [ ] Map between domain entities and TypeORM entities
- [ ] 8.2 Create `infrastructure/persistence/ai-module-test.repository.ts`:
  - [ ] Implement `IAIModuleTestRepository`
  - [ ] Use TypeORM repository internally
- [ ] 8.3 Create `infrastructure/persistence/ai-module-review.repository.ts`:
  - [ ] Implement `IAIModuleReviewRepository`
  - [ ] Use TypeORM repository internally

## 9. Infrastructure Layer: External Services

- [ ] 9.1 Create `infrastructure/external/ai-model.service.ts`:
  - [ ] Implement `IAIModelService` interface
  - [ ] Use existing `AIModelsService` or AI API calls
- [ ] 9.2 Create `infrastructure/external/module-registry.service.ts`:
  - [ ] Implement `IModuleRegistryService` interface
  - [ ] Use existing `ModuleRegistryService`
- [ ] 9.3 Create `infrastructure/external/workflow.service.ts`:
  - [ ] Implement `IWorkflowService` interface
  - [ ] Use existing `WorkflowInstanceService` or WorkflowContext services

## 10. Infrastructure Layer: Event Bus

- [ ] 10.1 Reuse event bus from organization-context or create `infrastructure/events/event-bus.service.ts`:
  - [ ] Implement `IEventPublisher` interface
  - [ ] Simple in-memory implementation (can upgrade later)

## 11. Infrastructure Layer: Controllers

- [ ] 11.1 Refactor `ai-modules.controller.ts`:
  - [ ] Remove business logic
  - [ ] Call application services
  - [ ] Map responses to HTTP DTOs
- [ ] 11.2 Ensure HTTP API contracts remain unchanged (backward compatible)

## 12. Module Registration

- [ ] 12.1 Create `ai-module-context.module.ts`:
  - [ ] Register domain services (if needed)
  - [ ] Register application services
  - [ ] Register infrastructure implementations
  - [ ] Wire up dependency injection
- [ ] 12.2 Update `ai-modules.module.ts` to import new module structure
- [ ] 12.3 Ensure all dependencies are properly injected

## 13. Testing

- [ ] 13.1 Write unit tests for domain entities (no mocks needed)
- [ ] 13.2 Write unit tests for domain services (mock only domain objects)
- [ ] 13.3 Write unit tests for application services (mock repositories, events, external services)
- [ ] 13.4 Write integration tests for infrastructure (test with real database)
- [ ] 13.5 Update existing tests to use new structure
- [ ] 13.6 Ensure all existing tests pass

## 14. Cleanup

- [ ] 14.1 Remove old service files:
  - [ ] `ai-modules.service.ts` (replaced by application services)
- [ ] 14.2 Update all imports across codebase
- [ ] 14.3 Remove unused dependencies if any
- [ ] 14.4 Update documentation

## 15. Validation

- [ ] 15.1 Run all existing tests
- [ ] 15.2 Test module creation via API
- [ ] 15.3 Test module publishing via API
- [ ] 15.4 Test review submission via API
- [ ] 15.5 Test patch generation via API
- [ ] 15.6 Test module registration
- [ ] 15.7 Test test execution
- [ ] 15.8 Verify HTTP API contracts unchanged
- [ ] 15.9 Run `openspec validate refactor-ai-module-to-ddd --strict`
