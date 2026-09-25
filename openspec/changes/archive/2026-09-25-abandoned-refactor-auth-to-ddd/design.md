# Auth DDD Architecture Design

## Context

The auth module currently has ~10 files in a flat structure:
- Services: `auth.service.ts` (login, validateUser, switchOrganization, validateToken)
- Controllers: `auth.controller.ts`
- Guards: `jwt-auth.guard.ts`, `jwt.strategy.ts`
- Infrastructure: JWT configuration

Business logic is mixed with:
- Database operations (UsersService, OrganizationsService)
- External API calls (JWT signing/verification)
- HTTP request handling (controllers)
- Password hashing (bcrypt)

## Goals

1. **Separate concerns**: Domain logic independent of infrastructure
2. **Testability**: Domain logic testable without databases/HTTP/external services
3. **Maintainability**: Clear boundaries for where code belongs
4. **Technology independence**: Can swap implementations without changing business logic
5. **Preserve behavior**: All existing functionality works identically after refactoring

## Non-Goals

- Changing auth features or behavior
- Optimizing performance (can be done separately)
- Refactoring other modules
- Changing database schema or HTTP API contracts
- Modifying JWT strategy/guards (stays as-is, but delegates to new services)

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
// domain/repositories/i-user-repository.ts (interface)
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
}

// infrastructure/persistence/user.repository.ts (implementation)
export class UserRepository implements IUserRepository {
  // Uses existing UsersService or User repository
}
```

### Decision 3: Domain Events

**Chosen**: Publish domain events for significant business events

**Rationale**:
- Decouples auth context from other contexts (e.g., audit logs, notifications)
- Enables future event-driven features
- Makes business events explicit

**Events to add**:
- `UserLoggedInEvent`
- `OrganizationSwitchedEvent`

**Implementation**: Reuse event bus from OrganizationContext or WorkflowContext

### Decision 4: External Services as Interfaces

**Chosen**: JWT and password hashing services defined as interfaces, implemented in infrastructure

**Rationale**:
- Domain/application don't depend on specific providers
- Can swap JWT providers or password hashing algorithms without changing business logic
- Easy to mock for testing

**Example**:
```typescript
// domain/services/i-jwt-service.ts
export interface IJwtService {
  sign(payload: JwtPayload): Promise<string>
  verify(token: string): Promise<JwtPayload | null>
}

// domain/services/i-password-service.ts
export interface IPasswordService {
  hash(password: string): Promise<string>
  compare(password: string, hash: string): Promise<boolean>
}
```

### Decision 5: Application Services for Use Cases

**Chosen**: One application service method per use case

**Rationale**:
- Clear mapping: "login" → `LoginService.execute()`
- Easy to find where use cases are implemented
- Can add CQRS commands/queries later if needed

**Application Services**:
- `LoginService` - Validate credentials, issue token, select organization
- `SwitchOrganizationService` - Switch user's active organization, issue new token
- `ValidateTokenService` - Validate JWT token
- `GetProfileService` - Get user profile with organizations

### Decision 6: Ports for External Contexts

**Chosen**: Auth context depends on User and Organization via ports (interfaces)

**Rationale**:
- Auth context doesn't own User entity (stays in users/)
- Auth context doesn't own Organization entity (stays in organizations/)
- Depends on them via interfaces (IUserRepository, IOrganizationRepository)
- Can be implemented using existing services or repositories

### Decision 7: Value Objects

**Chosen**: Extract common concepts as value objects

**Value Objects**:
- `JwtPayload` - Token payload structure (already exists, keep as interface/DTO)
- `Credentials` - Email/password pair (optional, can stay as DTO)

### Decision 8: Domain Services

**Chosen**: Pure business logic services (no I/O)

**Domain Services**:
- `CredentialValidator` - Validate email/password format (pure function)
- `OrganizationSelector` - Select organization from user's list (pure function)

### Decision 9: Mapping Strategy

**Chosen**: Keep existing User entity in `users/`, map in infrastructure repositories

**Rationale**:
- No database schema changes needed
- Existing entities can coexist with domain entities
- Infrastructure repositories handle mapping between domain and TypeORM entities

## Directory Structure

```
backend/src/auth-context/
├── domain/
│   ├── entities/
│   │   └── (none - User stays in users/, Organization stays in organizations/)
│   ├── value-objects/
│   │   ├── jwt-payload.vo.ts
│   │   └── index.ts
│   ├── domain-services/
│   │   ├── credential-validator.service.ts
│   │   ├── organization-selector.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── user-logged-in.event.ts
│   │   ├── organization-switched.event.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── i-user-repository.ts
│   │   ├── i-organization-repository.ts
│   │   └── tokens.ts
│   ├── services/
│   │   ├── i-jwt-service.ts
│   │   ├── i-password-service.ts
│   │   └── tokens.ts
│   ├── errors/
│   │   ├── domain-error.ts
│   │   ├── authentication-error.ts
│   │   └── index.ts
│   └── index.ts
├── application/
│   └── services/
│       ├── login.service.ts
│       ├── switch-organization.service.ts
│       ├── validate-token.service.ts
│       ├── get-profile.service.ts
│       └── index.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── user.repository.ts
│   │   ├── organization.repository.ts (adapter to OrganizationContext)
│   │   └── index.ts
│   ├── external/
│   │   ├── jwt.service.ts
│   │   ├── password.service.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── event-bus.service.ts (reuse from organization-context)
│   │   └── index.ts
│   └── index.ts
└── auth-context.module.ts
```

## Migration Steps

1. Create DDD directory structure
2. Create domain value objects and domain services
3. Create domain events
4. Create repository interfaces (IUserRepository, IOrganizationRepository)
5. Create external service interfaces (IJwtService, IPasswordService)
6. Create application services
7. Create infrastructure repositories (map domain ↔ existing services)
8. Create infrastructure external services (JWT, password)
9. Update controllers to use application services
10. Update JWT strategy/guards to use new services
11. Update module registration
12. Add tests
13. Remove old code
