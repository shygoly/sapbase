# Organization DDD Architecture Design

## Context

The organization module currently has ~15 files in a flat structure:
- Entities: `organization.entity.ts`, `organization-member.entity.ts`, `invitation.entity.ts`, `organization-activity.entity.ts`
- Services: `organizations.service.ts`, `invitations.service.ts`, `stripe.service.ts`
- Controllers: `organizations.controller.ts`, `invitations.controller.ts`, `invitations-public.controller.ts`, `subscriptions.controller.ts`
- Infrastructure: `tenant-context.middleware.ts`, decorators, guards

Business logic is mixed with:
- Database operations (TypeORM repositories)
- External API calls (Stripe)
- HTTP request handling (controllers)
- Caching (CacheService)
- Multi-tenancy middleware

## Goals

1. **Separate concerns**: Domain logic independent of infrastructure
2. **Testability**: Domain logic testable without databases/HTTP/external services
3. **Maintainability**: Clear boundaries for where code belongs
4. **Technology independence**: Can swap implementations without changing business logic
5. **Preserve behavior**: All existing functionality works identically after refactoring

## Non-Goals

- Changing organization features or behavior
- Optimizing performance (can be done separately)
- Refactoring other modules
- Changing database schema or HTTP API contracts
- Modifying tenant middleware (stays as-is)

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

**Example**:
```typescript
// domain/repositories/i-organization.repository.ts (interface)
export interface IOrganizationRepository {
  save(organization: Organization): Promise<void>
  findById(id: string): Promise<Organization | null>
  findBySlug(slug: string): Promise<Organization | null>
}

// infrastructure/persistence/organization.repository.ts (implementation)
export class OrganizationRepository implements IOrganizationRepository {
  // TypeORM implementation, maps between domain and TypeORM entities
}
```

### Decision 3: Domain Events

**Chosen**: Publish domain events for significant business events

**Rationale**:
- Decouples organization context from other contexts (e.g., audit logs, notifications)
- Enables future event-driven features
- Makes business events explicit

**Events to add**:
- `OrganizationCreatedEvent`
- `MemberAddedEvent`
- `MemberRemovedEvent`
- `MemberRoleUpdatedEvent`
- `InvitationCreatedEvent`
- `InvitationAcceptedEvent`
- `InvitationExpiredEvent`
- `InvitationCancelledEvent`

**Implementation**: Reuse event bus from WorkflowContext (or create new one if needed)

### Decision 4: Rich Domain Models

**Chosen**: Entities contain business methods, not just data

**Rationale**:
- Business rules encapsulated in entities (e.g., `organization.addMember()`, `invitation.accept()`)
- Easier to understand what entities can do
- Prevents invalid states

**Example**:
```typescript
// Before (anemic)
class Organization {
  members: OrganizationMember[]
  // No methods, just data
}

// After (rich)
class Organization {
  private members: OrganizationMember[]
  
  addMember(userId: string, role: OrganizationRole, invitedById: string): void {
    // Business rules: check if already member, validate role, etc.
  }
  
  removeMember(userId: string, removerId: string): void {
    // Business rules: verify remover is owner, prevent removing last owner
  }
}
```

### Decision 5: Application Services for Use Cases

**Chosen**: One application service method per use case

**Rationale**:
- Clear mapping: "create organization" → `CreateOrganizationService.execute()`
- Easy to find where use cases are implemented
- Can add CQRS commands/queries later if needed

**Application Services**:
- `CreateOrganizationService` - Create org, add creator as owner
- `AddMemberService` - Add existing user as member
- `InviteMemberService` - Create invitation
- `AcceptInvitationService` - Accept invitation, create membership
- `RemoveMemberService` - Remove member (with business rules)
- `UpdateMemberRoleService` - Update member role
- `UpdateOrganizationService` - Update org settings
- `GetOrganizationService` - Get org with access check
- `GetMembersService` - Get members list

### Decision 6: External Services as Interfaces

**Chosen**: Stripe/payment services defined as interfaces, implemented in infrastructure

**Rationale**:
- Domain/application don't depend on specific payment providers
- Can swap payment providers or add caching without changing business logic
- Easy to mock for testing

**Example**:
```typescript
// domain/services/i-subscription.service.ts
export interface ISubscriptionService {
  createCustomer(organizationId: string, email: string): Promise<string> // returns customerId
  createSubscription(customerId: string, planId: string): Promise<Subscription>
  cancelSubscription(subscriptionId: string): Promise<void>
}

// infrastructure/external/stripe-subscription.service.ts
export class StripeSubscriptionService implements ISubscriptionService {
  // Stripe API calls
}
```

### Decision 7: Value Objects

**Chosen**: Extract common concepts as value objects

**Value Objects**:
- `OrganizationSlug` - Slug generation and validation
- `OrganizationRole` - Role enum (already exists, keep as enum)
- `InvitationToken` - Token generation and validation
- `InvitationStatus` - Status enum (already exists, keep as enum)

### Decision 8: Domain Services

**Chosen**: Pure business logic services (no I/O)

**Domain Services**:
- `SlugGenerator` - Generate slug from name (pure function)
- `InvitationExpirationChecker` - Check if invitation expired (pure function)

### Decision 9: Mapping Strategy

**Chosen**: Keep existing TypeORM entities in `organizations/`, map in infrastructure repositories

**Rationale**:
- No database schema changes needed
- Existing entities can coexist with domain entities
- Infrastructure repositories handle mapping between domain and TypeORM entities

**Example**:
```typescript
// infrastructure/persistence/organization.repository.ts
export class OrganizationRepository implements IOrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    const typeOrmEntity = await this.typeOrmRepo.findOne({ where: { id } })
    if (!typeOrmEntity) return null
    return Organization.fromPersistence(typeOrmEntity) // Map to domain entity
  }
  
  async save(organization: Organization): Promise<void> {
    const typeOrmEntity = this.mapToTypeORM(organization)
    await this.typeOrmRepo.save(typeOrmEntity)
  }
}
```

### Decision 10: Caching Strategy

**Chosen**: Keep caching in infrastructure layer, application services can use cache-aware repositories

**Rationale**:
- Caching is an infrastructure concern
- Can be added transparently in repository implementations
- Domain/application don't need to know about caching

## Directory Structure

```
backend/src/organization-context/
├── domain/
│   ├── entities/
│   │   ├── organization.entity.ts
│   │   ├── organization-member.entity.ts
│   │   └── invitation.entity.ts
│   ├── value-objects/
│   │   ├── organization-slug.vo.ts
│   │   └── index.ts
│   ├── domain-services/
│   │   ├── slug-generator.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── organization-created.event.ts
│   │   ├── member-added.event.ts
│   │   ├── member-removed.event.ts
│   │   ├── member-role-updated.event.ts
│   │   ├── invitation-created.event.ts
│   │   ├── invitation-accepted.event.ts
│   │   ├── invitation-expired.event.ts
│   │   ├── invitation-cancelled.event.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── i-organization.repository.ts
│   │   ├── i-organization-member.repository.ts
│   │   ├── i-invitation.repository.ts
│   │   └── tokens.ts
│   ├── services/
│   │   ├── i-subscription.service.ts
│   │   └── tokens.ts
│   ├── errors/
│   │   ├── domain-error.ts
│   │   ├── business-rule-violation.ts
│   │   └── index.ts
│   └── index.ts
├── application/
│   └── services/
│       ├── create-organization.service.ts
│       ├── add-member.service.ts
│       ├── invite-member.service.ts
│       ├── accept-invitation.service.ts
│       ├── remove-member.service.ts
│       ├── update-member-role.service.ts
│       ├── update-organization.service.ts
│       ├── get-organization.service.ts
│       ├── get-members.service.ts
│       └── index.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── organization.repository.ts
│   │   ├── organization-member.repository.ts
│   │   ├── invitation.repository.ts
│   │   └── index.ts
│   ├── external/
│   │   ├── stripe-subscription.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── event-bus.service.ts (reuse from workflow-context or create new)
│   │   └── index.ts
│   └── index.ts
└── organization-context.module.ts
```

## Migration Steps

1. Create DDD directory structure
2. Create domain entities with business methods
3. Create value objects and domain services
4. Create domain events
5. Create repository interfaces
6. Create external service interfaces (ISubscriptionService)
7. Create application services
8. Create infrastructure repositories (map domain ↔ TypeORM)
9. Create infrastructure external services (Stripe)
10. Update controllers to use application services
11. Update module registration
12. Add tests
13. Remove old code
