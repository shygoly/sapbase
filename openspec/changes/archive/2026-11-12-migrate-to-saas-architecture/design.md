# Design: SaaS Architecture Migration

## Context
Current system is single-tenant with no organization/team concept. Users belong directly to the system. We need to introduce multi-tenancy while maintaining backward compatibility where possible.

## Goals / Non-Goals

### Goals
- Multi-tenant architecture with clear data isolation
- Stripe subscription management per organization
- Team member management with Owner/Member roles
- Seamless tenant context switching
- Scalable architecture that can grow with customer base

### Non-Goals
- Self-service signup (manual team creation initially)
- Usage-based billing (flat-rate subscriptions only)
- Multi-region support
- Custom domains per tenant

## Decisions

### Decision: Organization vs Team Terminology
**Decision**: Use "Organization" as the primary tenant concept, "Team" as an alias for consistency with Next.js saas-starter.

**Rationale**: 
- "Organization" is more enterprise-friendly
- Matches common SaaS terminology
- Can support sub-teams later if needed

**Alternatives considered**:
- "Workspace" - too generic
- "Tenant" - too technical for end users
- "Company" - too restrictive

### Decision: Data Isolation Strategy
**Decision**: Row-level security using organizationId foreign key on all tenant-scoped entities.

**Rationale**:
- Simpler than database-level isolation
- Easier to query across tenants for admin purposes
- TypeORM supports this pattern well
- Can migrate to separate databases later if needed

**Alternatives considered**:
- Separate databases per tenant - too complex for initial migration
- Schema-level isolation - PostgreSQL limitation, harder to manage

### Decision: Stripe Integration Approach
**Decision**: Direct Stripe API integration (not Stripe Billing) for subscription management.

**Rationale**:
- More control over subscription lifecycle
- Aligns with Next.js saas-starter pattern
- Easier to customize billing logic
- Can integrate Stripe Billing later if needed

**Alternatives considered**:
- Stripe Billing - less control, more abstraction
- Clerk Billing - adds dependency, current project doesn't use Clerk

### Decision: Team Member Roles
**Decision**: Two roles initially: Owner and Member.

**Rationale**:
- Simple and sufficient for MVP
- Matches Next.js saas-starter
- Can extend with more roles later

**Alternatives considered**:
- More granular roles (Admin, Editor, Viewer) - can add later
- Role-based permissions from existing system - too complex for initial migration

### Decision: Backend ORM
**Decision**: Keep TypeORM (current stack), don't migrate to Drizzle.

**Rationale**:
- Current codebase uses TypeORM extensively
- Migration to Drizzle would be a separate, large effort
- TypeORM supports multi-tenancy patterns
- Reduces scope of this change

**Alternatives considered**:
- Migrate to Drizzle (like saas-starter) - too large scope, separate change needed

## Architecture

### Database Schema Changes

```
Organizations (new)
├── id, name, slug, createdAt, updatedAt
├── stripeCustomerId, stripeSubscriptionId
├── planName, subscriptionStatus

OrganizationMembers (new)
├── id, organizationId, userId, role (owner/member)
├── joinedAt, invitedBy

Users (modified)
├── Keep existing fields
├── Remove direct organization reference
└── Access via OrganizationMembers join

All existing entities (modified)
├── Add organizationId foreign key
└── Add organization relation
```

### Backend Architecture

```
Middleware Stack:
1. AuthenticationMiddleware (existing)
2. TenantContextMiddleware (new) - extracts org from request
3. TenantGuard (new) - ensures user has access to org
4. DataIsolationInterceptor (new) - filters queries by orgId

Service Layer:
- All services become tenant-aware
- Queries automatically filtered by organizationId
- Admin services can bypass filters with special permission
```

### Frontend Architecture

```
Auth Flow:
1. User logs in
2. Fetch user's organizations
3. If single org: auto-select
4. If multiple orgs: show selector
5. Store selected org in context/store

Data Fetching:
- All API calls include organizationId header or query param
- Frontend components are org-scoped
- Team switcher in navigation
```

## Risks / Trade-offs

### Risk: Data Migration Complexity
**Mitigation**: 
- Create migration scripts to assign existing users to default organization
- Test migration on staging with production data copy
- Rollback plan: keep old schema until migration verified

### Risk: Performance Impact
**Mitigation**:
- Add indexes on organizationId columns
- Monitor query performance
- Consider query optimization if needed

### Risk: Breaking Changes
**Mitigation**:
- Version API endpoints (v1/v2)
- Maintain backward compatibility where possible
- Clear migration guide for existing users

### Trade-off: Simplicity vs Flexibility
- Chose simpler Owner/Member roles over complex RBAC
- Can extend later if needed
- Faster to implement and test

## Migration Plan

### Phase 1: Database Schema
1. Create Organization and OrganizationMember entities
2. Add organizationId to all tenant-scoped entities
3. Create migration scripts
4. Test migrations on staging

### Phase 2: Backend Changes
1. Implement tenant context middleware
2. Update all services to be tenant-aware
3. Add data isolation interceptors
4. Update authentication to support organizations
5. Add Stripe integration

### Phase 3: Frontend Changes
1. Add organization context/switcher
2. Update all API calls to include org context
3. Update UI components for team-scoped views
4. Add billing/subscription pages

### Phase 4: Data Migration
1. Create default organization for existing users
2. Migrate existing data to default organization
3. Verify data integrity
4. Deploy to production

### Rollback Plan
- Keep old API endpoints active during transition
- Database migrations are reversible
- Feature flags to toggle new vs old behavior

## Open Questions
- Should we support users belonging to multiple organizations from day one?
- How to handle existing admin users - create a special "System" organization?
- Should organizations have billing limits or feature flags?
- How to handle organization deletion - soft delete or hard delete?
