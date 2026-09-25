# Change: Refactor Organization Module to DDD Architecture

## Why

The current organization module (`backend/src/organizations/`) follows a traditional layered architecture where business logic, data access, and infrastructure concerns are mixed together. This creates several problems:

1. **Business rules scattered**: Domain logic (e.g., "cannot remove last owner", "invitation expiration", "slug generation") is embedded in service classes that also handle database operations, caching, and external API calls (Stripe)
2. **Tight coupling**: Services directly depend on TypeORM repositories, cache service, and Stripe API, making testing difficult and technology swaps expensive
3. **Unclear boundaries**: No clear separation between what the system does (domain) vs. how it does it (infrastructure), leading to confusion about where new features belong
4. **Hard to test**: Domain logic cannot be tested in isolation without setting up databases, cache, and external payment services

Refactoring to Domain-Driven Design (DDD) architecture will:
- Centralize business rules in domain entities and domain services (e.g., Organization.addMember(), Invitation.accept(), role validation rules)
- Separate concerns into domain, application, and infrastructure layers (easier to test and maintain)
- Enable technology independence (can swap databases, cache providers, payment providers without touching business logic)
- Provide clear boundaries for team collaboration and feature development

## What Changes

- **REFACTORED**: Organization module structure from flat organization to DDD layers (`domain/`, `application/`, `infrastructure/`)
- **REFACTORED**: Entities from anemic models to rich domain models with business methods (Organization.addMember(), Invitation.accept(), etc.)
- **REFACTORED**: Services split into domain services (pure business logic) and application services (use case orchestration)
- **ADDED**: Domain events for organization lifecycle (OrganizationCreated, MemberAdded, InvitationAccepted, etc.)
- **ADDED**: Repository interfaces in domain/application layers, implementations in infrastructure
- **REFACTORED**: Controllers to thin HTTP adapters that delegate to application services
- **REFACTORED**: External service dependencies (Stripe) to interfaces with infrastructure implementations
- **MODIFIED**: Module structure to follow dependency inversion (domain ← application ← infrastructure)

## Impact

- **ARCHITECTURE CHANGE**: Significant refactoring of organization module structure
- Affected specs: None explicitly (architecture change, behavior preserved)
- Affected code:
  - Backend: Complete restructure of `backend/src/organizations/` directory
  - New `backend/src/organization-context/` directory with DDD structure
  - All organization-related files moved to new layer structure
  - New interfaces and abstractions introduced
- **BREAKING**: Internal API changes (service method signatures, dependency injection)
- **NON-BREAKING**: External API endpoints remain unchanged (HTTP contracts preserved)
- Testing: Domain logic can now be unit tested without infrastructure setup

## Out of Scope (this change)

- Refactoring other modules (users, auth, ai-modules) to DDD (separate changes)
- Changing organization features or behavior
- Modifying database schema
- Changing HTTP API contracts
- Performance optimizations (can be done after refactoring)
- Tenant middleware changes (stays as-is)

## Migration Strategy

1. **Phase 1**: Create new DDD structure alongside existing code (parallel implementation)
2. **Phase 2**: Migrate domain logic first (entities, domain services, events)
3. **Phase 3**: Migrate application services (use cases: create org, add member, invite, accept invitation)
4. **Phase 4**: Migrate infrastructure (repositories, controllers, Stripe service)
5. **Phase 5**: Update module registration and remove old code
6. **Phase 6**: Update tests to use new structure

This incremental approach allows the system to remain functional during refactoring.
