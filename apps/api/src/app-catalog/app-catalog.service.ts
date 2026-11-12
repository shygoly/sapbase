import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AuditLog } from '@sap/platform-core/audit-logs/audit-log.entity'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { EntitlementsService } from '@sap/platform-core/entitlements/entitlements.service'
import { UsageMeteringService } from '@sap/platform-core/entitlements/usage-metering.service'
import { BusinessAppsService } from '../business-apps/business-apps.service'
import { AppBrandConfig } from './entities/app-brand-config.entity'
import {
  AppRoleBinding,
  type AppRoleSource,
  type AppRoleStatus,
} from './entities/app-role-binding.entity'

export interface AppCatalog {
  installation: {
    id: string
    appKey: string
    blueprintId: string
    blueprintVersion: string
    status: string
    deploymentProfile: string
  }
  roles: Array<{
    id: string
    name: string
    permissions: string[]
    source: AppRoleSource
    status: AppRoleStatus
  }>
  permissions: string[]
  menus: Array<{
    identifier: string
    label: string
    path: string
    icon?: string
    order: number
    permissions: string[]
  }>
  routes: Array<{
    identifier: string
    label?: string
    type: 'list' | 'form' | 'detail'
    entity: string
    route?: string
    fields: string[]
  }>
  branding: {
    appName: string | null
    logoUrl: string | null
    faviconUrl: string | null
    theme: Record<string, string> | null
    customCss: string | null
    supportEmail: string | null
    supportUrl: string | null
  } | null
  audit: {
    total: number
    recent: Array<{
      id: string
      action: string
      status: string
      actor: string
      timestamp: string
    }>
  }
  usage: Array<{ metric: string; quantity: number }>
  entitlement: {
    status: string
    planName: string
    limits: Record<string, number>
    validTo: string | null
  } | null
}

export interface UpsertAppRoleInput {
  organizationId: string
  appKey: string
  name: string
  permissions: string[]
  source?: AppRoleSource
  status?: AppRoleStatus
  actor: string
  actorId: string
}

@Injectable()
export class AppCatalogService {
  constructor(
    @InjectRepository(AppRoleBinding)
    private readonly roles: Repository<AppRoleBinding>,
    @InjectRepository(AppBrandConfig)
    private readonly brands: Repository<AppBrandConfig>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    private readonly apps: BusinessAppsService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageMeteringService,
    private readonly audit: AuditLogsService,
  ) {}

  async getCatalog(
    installationId: string,
    organizationId: string,
    grantedPermissions: readonly string[],
  ): Promise<AppCatalog> {
    const installation = await this.apps.resolveActiveForOrganization(
      installationId,
      organizationId,
    )
    const [navigation, roles, branding, auditRows, auditTotal, usage, entitlement] =
      await Promise.all([
        this.apps.navigationForInstallation(
          installationId,
          organizationId,
          grantedPermissions,
        ),
        this.roles.find({
          where: {
            organizationId,
            appKey: installation.appKey,
            status: 'active',
          },
          order: { name: 'ASC' },
        }),
        this.brands.findOne({
          where: { organizationId, appKey: installation.appKey },
        }),
        this.auditLogs.find({
          where: { organizationId, appInstallationId: installationId },
          order: { timestamp: 'DESC' },
          take: 20,
        }),
        this.auditLogs.count({
          where: { organizationId, appInstallationId: installationId },
        }),
        this.usage.summary(organizationId, installation.appKey),
        this.entitlements.findActive(organizationId, installation.appKey),
      ])

    return {
      installation: {
        id: installation.id,
        appKey: installation.appKey,
        blueprintId: installation.blueprintId,
        blueprintVersion: installation.blueprintVersion,
        status: installation.status,
        deploymentProfile: installation.deploymentProfile,
      },
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions ?? [],
        source: role.source,
        status: role.status,
      })),
      permissions: [...new Set(roles.flatMap((role) => role.permissions ?? []))].sort(),
      menus: navigation.navigation,
      routes: navigation.routes,
      branding: branding
        ? {
            appName: branding.appName,
            logoUrl: branding.logoUrl,
            faviconUrl: branding.faviconUrl,
            theme: branding.theme,
            customCss: branding.customCss,
            supportEmail: branding.supportEmail,
            supportUrl: branding.supportUrl,
          }
        : null,
      audit: {
        total: auditTotal,
        recent: auditRows.map((row) => ({
          id: row.id,
          action: row.action,
          status: row.status,
          actor: row.actor,
          timestamp: row.timestamp.toISOString(),
        })),
      },
      usage,
      entitlement: entitlement
        ? {
            status: entitlement.status,
            planName: entitlement.planName,
            limits: entitlement.limits ?? {},
            validTo: entitlement.validTo
              ? entitlement.validTo.toISOString()
              : null,
          }
        : null,
    }
  }

  async upsertRole(input: UpsertAppRoleInput): Promise<AppRoleBinding> {
    if (!input.name || !/^[a-zA-Z][A-Za-z0-9_-]{0,127}$/.test(input.name)) {
      throw new BadRequestException('角色名只允许字母开头、含字母/数字/_/-')
    }
    if (!Array.isArray(input.permissions)) {
      throw new BadRequestException('permissions 必须是数组')
    }
    const permissions = [...new Set(input.permissions.map((item) => item.trim()))].filter(
      Boolean,
    )
    let role = await this.roles.findOne({
      where: {
        organizationId: input.organizationId,
        appKey: input.appKey,
        name: input.name,
      },
    })
    if (!role) {
      role = this.roles.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        name: input.name,
        permissions,
        source: input.source ?? 'manual',
        status: input.status ?? 'active',
        createdById: input.actorId || null,
      })
    } else {
      role.permissions = permissions
      if (input.source) role.source = input.source
      if (input.status) role.status = input.status
    }
    const saved = await this.roles.save(role)
    await this.audit.create({
      organizationId: input.organizationId,
      action: 'app_role.changed',
      resource: 'app_role',
      resourceId: saved.id,
      actor: input.actor,
      status: 'success',
      metadata: {
        appKey: input.appKey,
        name: input.name,
        permissions,
        source: saved.source,
      },
      source: 'app-catalog',
    })
    return saved
  }

  async deleteRole(input: {
    organizationId: string
    appKey: string
    name: string
    actor: string
  }): Promise<void> {
    const role = await this.roles.findOne({
      where: {
        organizationId: input.organizationId,
        appKey: input.appKey,
        name: input.name,
      },
    })
    if (!role) throw new NotFoundException('应用角色不存在')
    await this.roles.remove(role)
    await this.audit.create({
      organizationId: input.organizationId,
      action: 'app_role.changed',
      resource: 'app_role',
      resourceId: role.id,
      actor: input.actor,
      status: 'success',
      metadata: { appKey: input.appKey, name: input.name, change: 'delete' },
      source: 'app-catalog',
    })
  }

  async getBranding(
    organizationId: string,
    appKey: string,
  ): Promise<AppBrandConfig | null> {
    return this.brands.findOne({ where: { organizationId, appKey } })
  }

  async updateBranding(input: {
    organizationId: string
    appKey: string
    actor: string
    appName?: string | null
    logoUrl?: string | null
    faviconUrl?: string | null
    theme?: Record<string, string> | null
    customCss?: string | null
    supportEmail?: string | null
    supportUrl?: string | null
  }): Promise<AppBrandConfig> {
    let branding = await this.brands.findOne({
      where: { organizationId: input.organizationId, appKey: input.appKey },
    })
    if (!branding) {
      branding = this.brands.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        appName: input.appName ?? null,
        logoUrl: input.logoUrl ?? null,
        faviconUrl: input.faviconUrl ?? null,
        theme: (input.theme as AppBrandConfig['theme']) ?? null,
        customCss: input.customCss ?? null,
        supportEmail: input.supportEmail ?? null,
        supportUrl: input.supportUrl ?? null,
      })
    } else {
      if (input.appName !== undefined) branding.appName = input.appName
      if (input.logoUrl !== undefined) branding.logoUrl = input.logoUrl
      if (input.faviconUrl !== undefined) branding.faviconUrl = input.faviconUrl
      if (input.theme !== undefined) {
        branding.theme = (input.theme as AppBrandConfig['theme']) ?? null
      }
      if (input.customCss !== undefined) branding.customCss = input.customCss
      if (input.supportEmail !== undefined) {
        branding.supportEmail = input.supportEmail
      }
      if (input.supportUrl !== undefined) branding.supportUrl = input.supportUrl
    }
    const saved = await this.brands.save(branding)
    await this.audit.create({
      organizationId: input.organizationId,
      action: 'app_branding.changed',
      resource: 'app_branding',
      resourceId: saved.id,
      actor: input.actor,
      status: 'success',
      metadata: { appKey: input.appKey },
      source: 'app-catalog',
    })
    return saved
  }

  /** 给 AppContextGuard/菜单解析复用的有效权限并集。 */
  async effectiveAppPermissions(
    organizationId: string,
    appKey: string,
  ): Promise<string[]> {
    const roles = await this.roles.find({
      where: { organizationId, appKey, status: In(['active']) },
    })
    return [...new Set(roles.flatMap((role) => role.permissions ?? []))].sort()
  }
}
