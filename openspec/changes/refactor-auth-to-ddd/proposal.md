# Change: Refactor Auth Module to DDD Architecture

## Why

The current auth module (`backend/src/auth/`) follows a traditional layered architecture where business logic, data access, and infrastructure concerns are mixed together. This creates several problems:

1. **Business rules scattered**: Domain logic (e.g., credential validation, token generation, organization selection) is embedded in service classes that also handle database operations, JWT signing, and HTTP request handling
2. **Tight coupling**: Services directly depend on UsersService, OrganizationsService, JwtService, making testing difficult and technology swaps expensive
3. **Unclear boundaries**: No clear separation between what the system does (domain) vs. how it does it (infrastructure), leading to confusion about where new features belong
4. **Hard to test**: Domain logic cannot be tested in isolation without setting up databases, JWT services, and external dependencies

Refactoring to Domain-Driven Design (DDD) architecture will:
- Centralize business rules in domain entities and domain services (e.g., credential validation, token payload construction)
- Separate concerns into domain, application, and infrastructure layers (easier to test and maintain)
- Enable technology independence (can swap JWT providers, password hashing algorithms without touching business logic)
- Provide clear boundaries for team collaboration and feature development

## What Changes

- **REFACTORED**: Auth module structure from flat organization to DDD layers (`domain/`, `application/`, `infrastructure/`)
- **REFACTORED**: Services split into domain services (pure business logic) and application services (use case orchestration)
- **ADDED**: Domain events for auth lifecycle (UserLoggedInEvent, OrganizationSwitchedEvent)
- **ADDED**: Repository interfaces in domain/application layers, implementations in infrastructure
- **REFACTORED**: Controllers to thin HTTP adapters that delegate to application services
- **REFACTORED**: External service dependencies (JWT, password hashing) to interfaces with infrastructure implementations
- **MODIFIED**: Module structure to follow dependency inversion (domain ← application ← infrastructure)

## Impact

- **ARCHITECTURE CHANGE**: Significant refactoring of auth module structure
- Affected specs: None explicitly (architecture change, behavior preserved)
- Affected code:
  - Backend: Complete restructure of `backend/src/auth/` directory
  - New `backend/src/auth-context/` directory with DDD structure
  - All auth-related files moved to new layer structure
  - New interfaces and abstractions introduced
- **BREAKING**: Internal API changes (service method signatures, dependency injection)
- **NON-BREAKING**: External API endpoints remain unchanged (HTTP contracts preserved)
- Testing: Domain logic can now be unit tested without infrastructure setup

## Out of Scope (this change)

- Refactoring other modules (users, organizations, ai-modules) to DDD (separate changes)
- Changing auth features or behavior
- Modifying database schema
- Changing HTTP API contracts
- Performance optimizations (can be done after refactoring)
- JWT strategy/guard changes (stays as-is, but delegates to new services)

## Migration Strategy

1. **Phase 1**: Create new DDD structure alongside existing code (parallel implementation)
2. **Phase 2**: Migrate domain logic first (entities, domain services, events)
3. **Phase 3**: Migrate application services (use cases: login, switch organization, validate token)
4. **Phase 4**: Migrate infrastructure (repositories, controllers, JWT service, password hashing)
5. **Phase 5**: Update module registration and remove old code
6. **Phase 6**: Update tests to use new structure

This incremental approach allows the system to remain functional during refactoring.
