## 1. Database Schema Changes
- [x] 1.1 Create Organization entity (id, name, slug, stripeCustomerId, stripeSubscriptionId, planName, subscriptionStatus)
- [x] 1.2 Create OrganizationMember entity (organizationId, userId, role, joinedAt, invitedBy)
- [x] 1.3 Add organizationId to User entity (nullable, for migration)
- [x] 1.4 Add organizationId to all tenant-scoped entities (Department, Role, AuditLog, Setting, Permission, MenuItem, AIModule, ModuleRegistry, etc.)
- [x] 1.5 Create database migration scripts
- [x] 1.6 Add indexes on organizationId columns for performance
- [x] 1.7 Create seed script for default organization (covered by migration script)

## 2. Backend: Multi-Tenant Infrastructure
- [x] 2.1 Create TenantContextMiddleware to extract organization from request
- [x] 2.2 Create TenantGuard decorator for route protection
- [x] 2.3 Create DataIsolationInterceptor to filter queries by organizationId
- [x] 2.4 Create OrganizationService for CRUD operations
- [x] 2.5 Create OrganizationMemberService for member management
- [x] 2.6 Update BaseEntity or create TenantAwareEntity base class
- [x] 2.7 Add organization context to request object (custom decorator)

## 3. Backend: Service Layer Updates
- [ ] 3.1 Update UsersService to be tenant-aware
- [x] 3.2 Update DepartmentsService to filter by organizationId
- [x] 3.3 Update RolesService to filter by organizationId
- [ ] 3.4 Update AuditLogsService to filter by organizationId
- [x] 3.5 Update SettingsService to filter by organizationId
- [x] 3.6 Update PermissionsService to filter by organizationId
- [x] 3.7 Update MenuService to filter by organizationId
- [x] 3.8 Update AIModulesService to filter by organizationId
- [x] 3.9 Update ModuleRegistryService to filter by organizationId
- [ ] 3.10 Update all other services to be tenant-aware

## 4. Backend: Authentication & Authorization
- [x] 4.1 Update AuthService to support organization context
- [x] 4.2 Update JWT payload to include organizationId
- [x] 4.3 Update AuthGuard to validate organization access
- [x] 4.4 Add organization switching endpoint
- [x] 4.5 Update user profile endpoint to include organizations list

## 5. Backend: Stripe Integration
- [x] 5.1 Install Stripe SDK
- [x] 5.2 Create StripeService for API interactions
- [x] 5.3 Create SubscriptionService for subscription management
- [x] 5.4 Create webhook handler for Stripe events
- [x] 5.5 Add subscription status sync logic
- [x] 5.6 Create billing endpoints (create checkout session, manage subscription)

## 6. Backend: Team Management
- [x] 6.1 Create invitation system (Invitation entity)
- [x] 6.2 Create InvitationService for sending/accepting invitations
- [x] 6.3 Add team member management endpoints (invite, remove, update role)
- [ ] 6.4 Add activity logging for team events
- [ ] 6.5 Create ActivityLogService

## 7. Frontend: Organization Context
- [x] 7.1 Create OrganizationContext/Provider
- [x] 7.2 Create organization store (Zustand)
- [x] 7.3 Add organization switcher component
- [x] 7.4 Update auth flow to fetch organizations
- [x] 7.5 Add organization selection after login
- [x] 7.6 Update API client to include organizationId in requests

## 8. Frontend: UI Updates
- [ ] 8.1 Add organization selector to navigation
- [ ] 8.2 Update all pages to be organization-scoped
- [ ] 8.3 Create team management page
- [ ] 8.4 Create billing/subscription page
- [ ] 8.5 Create pricing page
- [ ] 8.6 Update user profile to show organizations
- [ ] 8.7 Add invitation acceptance flow

## 9. Frontend: Stripe Integration
- [ ] 9.1 Integrate Stripe Checkout for subscription
- [ ] 9.2 Add subscription status display
- [ ] 9.3 Add plan upgrade/downgrade UI
- [ ] 9.4 Add Stripe Customer Portal integration
- [ ] 9.5 Handle webhook events on frontend (if needed)

## 10. Data Migration
- [x] 10.1 Create migration script to create default organization
- [x] 10.2 Migrate existing users to default organization
- [x] 10.3 Migrate existing data to default organization
- [ ] 10.4 Verify data integrity after migration
- [x] 10.5 Create rollback script (implemented in migration down method)

## 11. Testing
- [ ] 11.1 Write unit tests for OrganizationService
- [ ] 11.2 Write unit tests for OrganizationMemberService
- [ ] 11.3 Write unit tests for StripeService
- [ ] 11.4 Write E2E tests for team management flow
- [ ] 11.5 Write E2E tests for subscription flow
- [ ] 11.6 Write E2E tests for data isolation
- [ ] 11.7 Test multi-organization scenarios

## 12. Documentation
- [ ] 12.1 Update API documentation with organization context
- [ ] 12.2 Create migration guide for existing users
- [ ] 12.3 Document Stripe setup and configuration
- [ ] 12.4 Update deployment documentation
- [ ] 12.5 Create admin guide for organization management
