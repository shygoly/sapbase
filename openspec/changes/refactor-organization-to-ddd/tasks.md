## 1. Create DDD Directory Structure

- [ ] 1.1 Create `organization-context/domain/entities/` directory
- [ ] 1.2 Create `organization-context/domain/value-objects/` directory
- [ ] 1.3 Create `organization-context/domain/domain-services/` directory
- [ ] 1.4 Create `organization-context/domain/events/` directory
- [ ] 1.5 Create `organization-context/domain/repositories/` directory
- [ ] 1.6 Create `organization-context/domain/services/` directory
- [ ] 1.7 Create `organization-context/application/services/` directory
- [ ] 1.8 Create `organization-context/infrastructure/persistence/` directory
- [ ] 1.9 Create `organization-context/infrastructure/external/` directory
- [ ] 1.10 Create `organization-context/infrastructure/events/` directory

## 2. Domain Layer: Entities and Value Objects

- [ ] 2.1 Copy `organization.entity.ts` to `domain/entities/` and remove TypeORM decorators
- [ ] 2.2 Add business methods to `Organization`:
  - [ ] `create()` static factory method with validation
  - [ ] `addMember(userId, role, invitedById)` method with business rules
  - [ ] `removeMember(userId, removerId)` method (verify owner, prevent removing last owner)
  - [ ] `updateMemberRole(userId, newRole, updaterId)` method
  - [ ] `canBeUpdatedBy(userId)` method
- [ ] 2.3 Copy `organization-member.entity.ts` to `domain/entities/` and enrich:
  - [ ] `create()` static factory method
  - [ ] Business validation methods
- [ ] 2.4 Copy `invitation.entity.ts` to `domain/entities/` and enrich:
  - [ ] `create()` static factory method
  - [ ] `accept(userId)` method with business rules
  - [ ] `expire()` method
  - [ ] `cancel()` method
  - [ ] `isExpired()` method
- [ ] 2.5 Create `OrganizationSlug` value object in `domain/value-objects/organization-slug.vo.ts`
- [ ] 2.6 Create domain error classes (`DomainError`, `BusinessRuleViolation`) - reuse from workflow-context or create new

## 3. Domain Layer: Domain Services

- [ ] 3.1 Create `domain/domain-services/slug-generator.service.ts` (pure function)
- [ ] 3.2 Create `domain/domain-services/invitation-expiration-checker.service.ts` (pure function)

## 4. Domain Layer: Events

- [ ] 4.1 Create `domain/events/organization-created.event.ts`
- [ ] 4.2 Create `domain/events/member-added.event.ts`
- [ ] 4.3 Create `domain/events/member-removed.event.ts`
- [ ] 4.4 Create `domain/events/member-role-updated.event.ts`
- [ ] 4.5 Create `domain/events/invitation-created.event.ts`
- [ ] 4.6 Create `domain/events/invitation-accepted.event.ts`
- [ ] 4.7 Create `domain/events/invitation-expired.event.ts`
- [ ] 4.8 Create `domain/events/invitation-cancelled.event.ts`
- [ ] 4.9 Reuse event publisher interface from workflow-context or create new

## 5. Domain Layer: Repository Interfaces

- [ ] 5.1 Create `domain/repositories/i-organization.repository.ts` interface
- [ ] 5.2 Create `domain/repositories/i-organization-member.repository.ts` interface
- [ ] 5.3 Create `domain/repositories/i-invitation.repository.ts` interface
- [ ] 5.4 Define methods needed by application layer (save, findById, findBySlug, findAll, etc.)
- [ ] 5.5 Create DI tokens in `domain/repositories/tokens.ts`

## 6. Domain Layer: External Service Interfaces

- [ ] 6.1 Create `domain/services/i-subscription.service.ts` interface (Stripe abstraction)
- [ ] 6.2 Create DI token in `domain/services/tokens.ts`

## 7. Application Layer: Services

- [ ] 7.1 Create `application/services/create-organization.service.ts`:
  - [ ] Extract logic from `OrganizationsService.create()`
  - [ ] Use repository interfaces
  - [ ] Call domain entity methods
  - [ ] Publish `OrganizationCreatedEvent`
- [ ] 7.2 Create `application/services/add-member.service.ts`:
  - [ ] Extract logic from `OrganizationsService.addMember()`
  - [ ] Use domain entity `addMember()` method
  - [ ] Publish `MemberAddedEvent`
- [ ] 7.3 Create `application/services/invite-member.service.ts`:
  - [ ] Extract logic from `InvitationsService.createInvitation()`
  - [ ] Use domain entity `create()` method
  - [ ] Publish `InvitationCreatedEvent`
- [ ] 7.4 Create `application/services/accept-invitation.service.ts`:
  - [ ] Extract logic from `InvitationsService.acceptInvitation()`
  - [ ] Use domain entity `accept()` method
  - [ ] Publish `InvitationAcceptedEvent`
- [ ] 7.5 Create `application/services/remove-member.service.ts`:
  - [ ] Extract logic from `OrganizationsService.removeMember()`
  - [ ] Use domain entity `removeMember()` method
  - [ ] Publish `MemberRemovedEvent`
- [ ] 7.6 Create `application/services/update-member-role.service.ts`:
  - [ ] Extract logic from `OrganizationsService.updateMemberRole()`
  - [ ] Use domain entity `updateMemberRole()` method
  - [ ] Publish `MemberRoleUpdatedEvent`
- [ ] 7.7 Create `application/services/update-organization.service.ts`:
  - [ ] Extract logic from `OrganizationsService.update()`
  - [ ] Use repository interfaces
- [ ] 7.8 Create `application/services/get-organization.service.ts`:
  - [ ] Extract query logic from `OrganizationsService.findOne()`
  - [ ] Use repository interfaces
- [ ] 7.9 Create `application/services/get-members.service.ts`:
  - [ ] Extract query logic from `OrganizationsService.getMembers()`
  - [ ] Use repository interfaces

## 8. Infrastructure Layer: Repositories

- [ ] 8.1 Create `infrastructure/persistence/organization.repository.ts`:
  - [ ] Implement `IOrganizationRepository`
  - [ ] Use TypeORM repository internally
  - [ ] Map between domain entities and TypeORM entities
- [ ] 8.2 Create `infrastructure/persistence/organization-member.repository.ts`:
  - [ ] Implement `IOrganizationMemberRepository`
  - [ ] Use TypeORM repository internally
- [ ] 8.3 Create `infrastructure/persistence/invitation.repository.ts`:
  - [ ] Implement `IInvitationRepository`
  - [ ] Use TypeORM repository internally

## 9. Infrastructure Layer: External Services

- [ ] 9.1 Create `infrastructure/external/stripe-subscription.service.ts`:
  - [ ] Implement `ISubscriptionService` interface
  - [ ] Move logic from `StripeService`
  - [ ] Call Stripe API

## 10. Infrastructure Layer: Event Bus

- [ ] 10.1 Reuse event bus from workflow-context or create `infrastructure/events/event-bus.service.ts`:
  - [ ] Implement `IEventPublisher` interface
  - [ ] Simple in-memory implementation (can upgrade later)

## 11. Infrastructure Layer: Controllers

- [ ] 11.1 Refactor `organizations.controller.ts`:
  - [ ] Remove business logic
  - [ ] Call application services
  - [ ] Map responses to HTTP DTOs
- [ ] 11.2 Refactor `invitations.controller.ts` similarly
- [ ] 11.3 Refactor `invitations-public.controller.ts` similarly
- [ ] 11.4 Refactor `subscriptions.controller.ts` similarly
- [ ] 11.5 Ensure HTTP API contracts remain unchanged (backward compatible)

## 12. Module Registration

- [ ] 12.1 Create `organization-context.module.ts`:
  - [ ] Register domain services (if needed)
  - [ ] Register application services
  - [ ] Register infrastructure implementations
  - [ ] Wire up dependency injection
- [ ] 12.2 Update `organizations.module.ts` to import new module structure
- [ ] 12.3 Ensure all dependencies are properly injected

## 13. Update Entity Decorators

- [ ] 13.1 Keep existing TypeORM entities in `organizations/` (no changes)
- [ ] 13.2 Ensure infrastructure repositories map correctly between domain and TypeORM entities

## 14. Testing

- [ ] 14.1 Write unit tests for domain entities (no mocks needed)
- [ ] 14.2 Write unit tests for domain services (mock only domain objects)
- [ ] 14.3 Write unit tests for application services (mock repositories, events, external services)
- [ ] 14.4 Write integration tests for infrastructure (test with real database)
- [ ] 14.5 Update existing tests to use new structure
- [ ] 14.6 Ensure all existing tests pass

## 15. Cleanup

- [ ] 15.1 Remove old service files:
  - [ ] `organizations.service.ts` (replaced by application services + repositories)
  - [ ] `invitations.service.ts` (replaced by application services + repositories)
  - [ ] `stripe.service.ts` (moved to infrastructure/external)
- [ ] 15.2 Update all imports across codebase
- [ ] 15.3 Remove unused dependencies if any
- [ ] 15.4 Update documentation

## 16. Validation

- [ ] 16.1 Run all existing tests
- [ ] 16.2 Test organization creation via API
- [ ] 16.3 Test member addition via API
- [ ] 16.4 Test invitation creation and acceptance via API
- [ ] 16.5 Test member removal via API
- [ ] 16.6 Test role updates via API
- [ ] 16.7 Test subscription operations via API
- [ ] 16.8 Verify HTTP API contracts unchanged
- [ ] 16.9 Run `openspec validate refactor-organization-to-ddd --strict`
