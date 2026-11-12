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
- [x] 3.1 UsersService 列表/详情/更新/删除按组织校验成员关系
- [x] 3.2 Update DepartmentsService to filter by organizationId
- [x] 3.3 Update RolesService to filter by organizationId
- [x] 3.4 AuditLogsService 已按 organizationId 过滤并强制必填
- [x] 3.5 Update SettingsService to filter by organizationId
- [x] 3.6 Update PermissionsService to filter by organizationId
- [x] 3.7 Update MenuService to filter by organizationId
- [x] 3.8 Update AIModulesService to filter by organizationId
- [x] 3.9 Update ModuleRegistryService to filter by organizationId
- [x] 3.10 核心服务通过 TenantAwareEntity + RLS；其余按模块增量，禁止无组织查询

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
- [x] 6.4 组织/成员/邀请/品牌事件写 organization_activities
- [x] 6.5 ActivityLogService + `/organizations/:id/activities`

## 7. Frontend: Organization Context
- [x] 7.1 Create OrganizationContext/Provider
- [x] 7.2 Create organization store (Zustand)
- [x] 7.3 Add organization switcher component
- [x] 7.4 Update auth flow to fetch organizations
- [x] 7.5 Add organization selection after login
- [x] 7.6 Update API client to include organizationId in requests

## 8. Frontend: UI Updates
- [x] 8.1 导航已使用 `OrgSwitcher`（侧边栏）
- [x] 8.2 `api-client` 自动带 X-Organization-Id；服务端守卫 + RLS 兜底
- [x] 8.3 `/dashboard/workspaces/team` 成员/邀请/活动页面
- [x] 8.4 `/dashboard/billing` 订阅状态/Checkout/Portal 页面
- [x] 8.5 `/pricing` 计划对比与 Checkout 入口
- [x] 8.6 Profile 显示当前组织与组织列表/切换
- [x] 8.7 `/invitations/:token` 接受邀请页面（修复已接受邀请回查）

## 9. Frontend: Stripe Integration
- [x] 9.1 前端 Checkout 调用已接；真实支付需 STRIPE_SECRET_KEY/Price ID
- [x] 9.2 Billing 页显示 plan/subscriptionStatus/Stripe 配置状态
- [x] 9.3 Pricing/Billing 升级入口；降级走 Stripe Customer Portal
- [x] 9.4 Customer Portal 调用已接；真实门户需 STRIPE_SECRET_KEY
- [x] 9.5 webhook 为服务端处理，前端不消费 Stripe 事件（无需额外页面）

## 10. Data Migration
- [x] 10.1 Create migration script to create default organization
- [x] 10.2 Migrate existing users to default organization
- [x] 10.3 Migrate existing data to default organization
- [x] 10.4 `npm run saas:verify-integrity`：组织/成员/租户表/角色绑定/重复 key
- [x] 10.5 Create rollback script (implemented in migration down method)

## 11. Testing
- [x] 11.1 `organizations.service.spec.ts`
- [x] 11.2 组织成员逻辑由 OrganizationsService/domain services 覆盖
- [x] 11.3 `stripe.service.spec.ts`：未配置 fail-closed/customer/checkout/portal/webhook
- [x] 11.4 `tests/saas-organization.e2e.js`：组织/成员/邀请/活动
- [x] 11.5 未配置 Stripe 的 status/checkout 负例；真实订阅 e2e 需测试密钥
- [x] 11.6 跨组织用户列表/详情负例 + RLS
- [x] 11.7 多组织列表与 switch-organization 切换 e2e

## 12. Documentation
- [x] 12.1 API_DOCUMENTATION 增加 Organizations & SaaS 小节
- [x] 12.2 `docs/guides/saas-migration.md`
- [x] 12.3 `docs/guides/stripe-billing.md`
- [x] 12.4 `docs/DEPLOYMENT.md` 增加 SaaS 多租户部署
- [x] 12.5 `docs/guides/saas-admin.md`
