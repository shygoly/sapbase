## 1. Create DDD Directory Structure

- [ ] 1.1 Create `auth-context/domain/value-objects/` directory
- [ ] 1.2 Create `auth-context/domain/domain-services/` directory
- [ ] 1.3 Create `auth-context/domain/events/` directory
- [ ] 1.4 Create `auth-context/domain/repositories/` directory
- [ ] 1.5 Create `auth-context/domain/services/` directory
- [ ] 1.6 Create `auth-context/application/services/` directory
- [ ] 1.7 Create `auth-context/infrastructure/persistence/` directory
- [ ] 1.8 Create `auth-context/infrastructure/external/` directory
- [ ] 1.9 Create `auth-context/infrastructure/events/` directory

## 2. Domain Layer: Value Objects and Domain Services

- [ ] 2.1 Create `domain/value-objects/jwt-payload.vo.ts` (move from auth.service.ts)
- [ ] 2.2 Create domain error classes (`DomainError`, `AuthenticationError`) - reuse from organization-context or create new
- [ ] 2.3 Create `domain/domain-services/credential-validator.service.ts` (pure function for email/password format)
- [ ] 2.4 Create `domain/domain-services/organization-selector.service.ts` (pure function to select org from list)

## 3. Domain Layer: Events

- [ ] 3.1 Create `domain/events/user-logged-in.event.ts`
- [ ] 3.2 Create `domain/events/organization-switched.event.ts`
- [ ] 3.3 Reuse event publisher interface from organization-context

## 4. Domain Layer: Repository Interfaces

- [ ] 4.1 Create `domain/repositories/i-user-repository.ts` interface
- [ ] 4.2 Create `domain/repositories/i-organization-repository.ts` interface (or reuse from organization-context)
- [ ] 4.3 Define methods needed by application layer (findByEmail, findById, findAll)
- [ ] 4.4 Create DI tokens in `domain/repositories/tokens.ts`

## 5. Domain Layer: External Service Interfaces

- [ ] 5.1 Create `domain/services/i-jwt-service.ts` interface
- [ ] 5.2 Create `domain/services/i-password-service.ts` interface
- [ ] 5.3 Create DI tokens in `domain/services/tokens.ts`

## 6. Application Layer: Services

- [ ] 6.1 Create `application/services/login.service.ts`:
  - [ ] Extract logic from `AuthService.login()`
  - [ ] Use repository interfaces
  - [ ] Use password service interface
  - [ ] Use JWT service interface
  - [ ] Call domain services
  - [ ] Publish `UserLoggedInEvent`
- [ ] 6.2 Create `application/services/switch-organization.service.ts`:
  - [ ] Extract logic from `AuthService.switchOrganization()`
  - [ ] Use repository interfaces
  - [ ] Use JWT service interface
  - [ ] Publish `OrganizationSwitchedEvent`
- [ ] 6.3 Create `application/services/validate-token.service.ts`:
  - [ ] Extract logic from `AuthService.validateToken()`
  - [ ] Use JWT service interface
- [ ] 6.4 Create `application/services/get-profile.service.ts`:
  - [ ] Extract logic from `AuthController.getProfile()`
  - [ ] Use repository interfaces

## 7. Infrastructure Layer: Repositories

- [ ] 7.1 Create `infrastructure/persistence/user.repository.ts`:
  - [ ] Implement `IUserRepository`
  - [ ] Use existing UsersService or User repository internally
- [ ] 7.2 Create `infrastructure/persistence/organization.repository.ts`:
  - [ ] Implement `IOrganizationRepository` (or reuse adapter from organization-context)
  - [ ] Use existing OrganizationsService or OrganizationContext application services

## 8. Infrastructure Layer: External Services

- [ ] 8.1 Create `infrastructure/external/jwt.service.ts`:
  - [ ] Implement `IJwtService` interface
  - [ ] Use NestJS JwtService internally
- [ ] 8.2 Create `infrastructure/external/password.service.ts`:
  - [ ] Implement `IPasswordService` interface
  - [ ] Use bcrypt internally

## 9. Infrastructure Layer: Event Bus

- [ ] 9.1 Reuse event bus from organization-context or create `infrastructure/events/event-bus.service.ts`:
  - [ ] Implement `IEventPublisher` interface
  - [ ] Simple in-memory implementation (can upgrade later)

## 10. Infrastructure Layer: Controllers

- [ ] 10.1 Refactor `auth.controller.ts`:
  - [ ] Remove business logic
  - [ ] Call application services
  - [ ] Map responses to HTTP DTOs
- [ ] 10.2 Ensure HTTP API contracts remain unchanged (backward compatible)

## 11. Infrastructure Layer: Guards and Strategy

- [ ] 11.1 Update `jwt.strategy.ts` to use new services (if needed)
- [ ] 11.2 Update `jwt-auth.guard.ts` to use new services (if needed)
- [ ] 11.3 Ensure guards still work correctly

## 12. Module Registration

- [ ] 12.1 Create `auth-context.module.ts`:
  - [ ] Register domain services (if needed)
  - [ ] Register application services
  - [ ] Register infrastructure implementations
  - [ ] Wire up dependency injection
- [ ] 12.2 Update `auth.module.ts` to import new module structure
- [ ] 12.3 Ensure all dependencies are properly injected

## 13. Testing

- [ ] 13.1 Write unit tests for domain services (no mocks needed)
- [ ] 13.2 Write unit tests for application services (mock repositories, events, external services)
- [ ] 13.3 Write integration tests for infrastructure (test with real JWT/password)
- [ ] 13.4 Update existing tests to use new structure
- [ ] 13.5 Ensure all existing tests pass

## 14. Cleanup

- [ ] 14.1 Remove old service files:
  - [ ] `auth.service.ts` (replaced by application services)
- [ ] 14.2 Update all imports across codebase
- [ ] 14.3 Remove unused dependencies if any
- [ ] 14.4 Update documentation

## 15. Validation

- [ ] 15.1 Run all existing tests
- [ ] 15.2 Test login via API
- [ ] 15.3 Test switch organization via API
- [ ] 15.4 Test token validation
- [ ] 15.5 Test get profile
- [ ] 15.6 Verify HTTP API contracts unchanged
- [ ] 15.7 Run `openspec validate refactor-auth-to-ddd --strict`
