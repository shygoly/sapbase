/**
 * platform-core 实体注册点（唯一真源）
 *
 * 为什么需要显式汇总：
 *   TypeORM 的 `autoLoadEntities` 只收集 `forFeature` 注册过的实体；漏注册不会在
 *   编译期报错，而是启动后访问该表时 500（历史上 `BrandConfig` 漏注册过一次）。
 *   这里把平台基座的 ORM 实体集中成一个数组，组合根用它填 DataSource.entities，
 *   `PlatformEntityRegistrationCheck` 再在启动时反向核对 forFeature 覆盖。
 */
import { AuditLog } from './audit-logs/audit-log.entity'
import { BrandConfig } from './organizations/brand-config.entity'
import { DataPolicy } from './data-scope/entities/data-policy.entity'
import { Department } from './departments/department.entity'
import { Invitation } from './organizations/invitation.entity'
import { Job } from './jobs/job.entity'
import { JobAttempt } from './jobs/job-attempt.entity'
import { JobEvent } from './jobs/job-event.entity'
import { Organization } from './organizations/organization.entity'
import { OrganizationActivity } from './organizations/organization-activity.entity'
import { OrganizationMemberRole } from './identity/organization-member-role.entity'
import { AuthSession } from './identity/auth-session.entity'
import { IdentityProvider } from './identity/identity-provider.entity'
import { IdentityLink } from './identity/identity-link.entity'
import { AuthLoginEvent } from './identity/auth-login-event.entity'
import { IdentitySyncRun } from './identity/identity-sync-run.entity'
import { ServiceClient } from './identity/service-client.entity'
import { OrganizationMember } from './organizations/organization-member.entity'
import { Permission } from './permissions/permission.entity'
import { Role } from './roles/role.entity'
import { ScopeBinding } from './data-scope/entities/scope-binding.entity'
import { ScopeDimension } from './data-scope/entities/scope-dimension.entity'
import { ScopeMembership } from './data-scope/entities/scope-membership.entity'
import { ScopeNode } from './data-scope/entities/scope-node.entity'
import { ScopeVersion } from './data-scope/entities/scope-version.entity'
import { Setting } from './settings/setting.entity'
import { User } from './users/user.entity'

/**
 * 平台基座拥有的全部 ORM 实体。
 *
 * 注意：`organization-context/domain/entities/*` 是纯领域模型（无 TypeORM 装饰器），
 * 不在本清单内；本清单只列会被 DataSource 注册的实体类。
 */
export const PLATFORM_CORE_ENTITIES = [
  User,
  Organization,
  OrganizationMember,
  Invitation,
  BrandConfig,
  OrganizationActivity,
  OrganizationMemberRole,
  AuthSession,
  IdentityProvider,
  IdentityLink,
  AuthLoginEvent,
  IdentitySyncRun,
  ServiceClient,
  Department,
  Role,
  AuditLog,
  Setting,
  Permission,
  ScopeDimension,
  ScopeNode,
  ScopeMembership,
  ScopeBinding,
  DataPolicy,
  ScopeVersion,
  Job,
  JobAttempt,
  JobEvent,
] as const

export type PlatformCoreEntity = (typeof PLATFORM_CORE_ENTITIES)[number]

export const PLATFORM_CORE_ENTITY_NAMES = PLATFORM_CORE_ENTITIES.map((entity) => entity.name)
