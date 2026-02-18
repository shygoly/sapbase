# Change: Migrate to SaaS Architecture

## Why
The current system operates as a single-tenant application. To scale and support multiple customers, we need to migrate to a multi-tenant SaaS architecture. This change will enable:
- Multiple organizations/teams to use the system independently
- Subscription-based billing with Stripe integration
- Team and member management
- Data isolation between tenants
- Scalable architecture that can support growth

This migration is inspired by Next.js SaaS Starter template (https://github.com/nextjs/saas-starter) but adapted to our NestJS backend + Next.js frontend stack.

## What Changes
- **ADDED**: Multi-tenant architecture with Organizations/Teams
- **ADDED**: Stripe integration for subscriptions and billing
- **ADDED**: Team member management (invitations, roles, permissions)
- **ADDED**: Data isolation middleware and query filters
- **ADDED**: Subscription plans and feature gating
- **ADDED**: Activity logging for team-level events
- **MODIFIED**: User entity to support multiple team memberships
- **MODIFIED**: All entities to include organizationId/teamId for data isolation
- **MODIFIED**: Authentication to support team context switching
- **MODIFIED**: API endpoints to be tenant-aware
- **MODIFIED**: Frontend to support team selection and team-scoped views

## Impact
- **BREAKING**: Database schema changes - all existing data needs migration
- **BREAKING**: API changes - endpoints now require team context
- **BREAKING**: Authentication flow changes - users must belong to teams
- Affected specs: `multi-tenant`, `billing-subscription`, `team-management`, `data-isolation`
- Affected code: 
  - Backend: All entities, services, controllers, middleware
  - Frontend: Auth flow, navigation, data fetching, UI components
  - Database: Schema migrations for all tables

## Out of Scope (this change)
- Self-service signup flow (can be added later)
- Advanced billing features (usage-based billing, metering)
- Multi-region deployment
- Team-level custom domains
- Advanced RBAC beyond Owner/Member roles (can be extended later)
