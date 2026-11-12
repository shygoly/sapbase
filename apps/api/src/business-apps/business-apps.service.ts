import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import semverGt = require('semver/functions/gt')
import { DataSource, EntityManager, In, Repository } from 'typeorm'
import type {
  BusinessAppDeploymentProfile,
  BusinessAppExecutionContext,
  BusinessAppInstallation as BusinessAppInstallationView,
  BusinessAppInstallationRevision as BusinessAppRevisionView,
  BusinessAppLicenseBinding,
  BusinessAppRevisionAction,
} from '@speckit/shared-schemas'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { RecordLifecycleService } from '../record-lifecycle/record-lifecycle.service'
import { EntitlementsService } from '@sap/platform-core/entitlements/entitlements.service'
import { AppRoleBinding } from '../app-catalog/entities/app-role-binding.entity'
import { checkAppUpgradeCompatibility } from './app-upgrade-compatibility'
import { BlueprintService } from '../blueprint/blueprint.service'
import { BusinessAppInstallationRevision } from './business-app-installation-revision.entity'
import { BusinessAppInstallation } from './business-app-installation.entity'

export interface InstallBusinessAppInput {
  organizationId: string
  packageId: string
  userId: string
  actor: string
  deploymentProfile?: BusinessAppDeploymentProfile
}

export interface LoadedAppRelease {
  packageId: string
  appKey: string
  version: string
  releaseDigest: string
  runtimeRequirement: string
  license: BusinessAppLicenseBinding | null
}

/**
 * App installation is the tenant-scoped runtime composition boundary.
 *
 * Installation, upgrade, and rollback never trust a client-supplied release
 * digest. They load the Blueprint through the existing fail-closed chain
 * (integrity, compile, signature/license, tenant authorization, atomic
 * binding) and compare the resulting digest to the recorded release.
 */
@Injectable()
export class BusinessAppsService {
  constructor(
    @InjectRepository(BusinessAppInstallation)
    private readonly installations: Repository<BusinessAppInstallation>,
    @InjectRepository(BusinessAppInstallationRevision)
    private readonly revisions: Repository<BusinessAppInstallationRevision>,
    private readonly blueprints: BlueprintService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly dataSource?: DataSource,
    @Optional() private readonly lifecycle?: RecordLifecycleService,
    @Optional() private readonly entitlements?: EntitlementsService,
    @Optional()
    @InjectRepository(AppRoleBinding)
    private readonly appRoles?: Repository<AppRoleBinding>,
  ) {}

  async listForOrganization(organizationId: string): Promise<BusinessAppInstallation[]> {
    this.requireOrganization(organizationId)
    return this.installations.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    })
  }

  async findForOrganization(
    id: string,
    organizationId: string,
  ): Promise<BusinessAppInstallation> {
    this.requireOrganization(organizationId)
    if (!id) throw new BadRequestException('缺少应用安装 id')

    const installation = await this.installations.findOne({
      where: { id, organizationId },
    })
    if (!installation) {
      throw new NotFoundException('应用不存在或不属于当前组织')
    }
    return installation
  }

  async resolveActiveForOrganization(
    id: string,
    organizationId: string,
  ): Promise<BusinessAppInstallation> {
    const installation = await this.findForOrganization(id, organizationId)
    if (installation.status !== 'active') {
      throw new NotFoundException('应用不存在、已停用或尚未完成安装')
    }
    return installation
  }

  async install(
    input: InstallBusinessAppInput,
    preloadedRelease?: LoadedAppRelease,
  ): Promise<BusinessAppInstallation> {
    this.requireOrganization(input.organizationId)
    if (!input.packageId) throw new BadRequestException('缺少 Blueprint 包 id')
    if (!input.userId) throw new BadRequestException('缺少安装用户身份')

    const release =
      preloadedRelease ?? (await this.loadRelease(input.packageId, input.organizationId))
    const existing = await this.installations.findOne({
      where: { organizationId: input.organizationId, appKey: release.appKey },
    })
    if (existing) {
      if (
        existing.blueprintVersion === release.version &&
        existing.releaseDigest === release.releaseDigest
      ) {
        return existing
      }
      throw new ConflictException(
        `应用 ${release.appKey} 已安装为 ${existing.blueprintVersion}；升级或回滚必须走独立生命周期流程`,
      )
    }

    if (this.entitlements && (await this.entitlements.hasAny(input.organizationId))) {
      const entitlement = await this.entitlements.assertEntitled(
        input.organizationId,
        release.appKey,
      )
      const installed = await this.installations.count({
        where: {
          organizationId: input.organizationId,
          appKey: release.appKey,
          status: In(['installing', 'active', 'suspended']),
        },
      })
      await this.entitlements.assertWithinQuota({
        organizationId: input.organizationId,
        appKey: release.appKey,
        metric: 'maxInstallations',
        amount: 1,
        used: installed,
        entitlement,
      })
    }

    const installation = this.installations.create({
      organizationId: input.organizationId,
      appKey: release.appKey,
      displayName: displayNameOf(release.appKey),
      slug: release.appKey,
      blueprintId: release.appKey,
      blueprintVersion: release.version,
      releaseDigest: release.releaseDigest,
      runtimeRequirement: release.runtimeRequirement,
      deploymentProfile: input.deploymentProfile ?? 'shared-saas',
      status: 'active',
      config: {},
      license: release.license,
      currentRevisionId: null,
      createdById: input.userId,
    })

    let saved: BusinessAppInstallation
    try {
      saved = await this.installations.manager.transaction(async (manager) => {
        const appRepo = manager.getRepository(BusinessAppInstallation)
        const revisionRepo = manager.getRepository(BusinessAppInstallationRevision)
        const row = await appRepo.save(installation)
        const revision = await revisionRepo.save(
          revisionRepo.create(
            this.revisionData(row, release, 'installed', null, input.userId),
          ),
        )
        row.currentRevisionId = revision.id
        return appRepo.save(row)
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.installations.findOne({
          where: { organizationId: input.organizationId, appKey: release.appKey },
        })
        if (
          raced &&
          raced.blueprintVersion === release.version &&
          raced.releaseDigest === release.releaseDigest
        ) {
          return raced
        }
        throw new ConflictException(`应用 ${release.appKey} 已被另一安装请求占用`)
      }
      throw error
    }

    await this.audit(input.organizationId, input.actor, 'business_app.install', saved, {
      packageId: input.packageId,
      deploymentProfile: saved.deploymentProfile,
    })
    return saved
  }

  /**
   * 2.7 默认 ERP 安装幂等 backfill：
   * - 只处理已有指定 blueprint 记录的组织
   * - 已有同 appKey 安装直接复用，不静默升级
   * - dryRun 只报告 wouldCreate，不写库
   */
  async backfillDefaultInstallation(input: {
    organizationId: string
    packageId: string
    blueprintId?: string
    userId: string
    actor: string
    deploymentProfile?: BusinessAppDeploymentProfile
    dryRun?: boolean
  }): Promise<{
    organizationId: string
    created: boolean
    skipped: boolean
    reason?: string
    wouldCreate?: boolean
    needsUpgrade?: boolean
    installation?: BusinessAppInstallation
    release?: LoadedAppRelease
  }> {
    this.requireOrganization(input.organizationId)
    if (!input.packageId) throw new BadRequestException('缺少 Blueprint 包 id')
    if (!input.userId) throw new BadRequestException('缺少安装用户身份')
    if (!this.dataSource) {
      throw new BadRequestException('未配置 DataSource，无法执行默认安装 backfill')
    }
    const blueprintId = input.blueprintId ?? 'auto-parts'
    const rows = (await this.dataSource.query(
      `SELECT count(*)::int AS count
         FROM public.blueprint_records
        WHERE "organizationId" = $1 AND "blueprintId" = $2`,
      [input.organizationId, blueprintId],
    )) as Array<{ count: number | string }>
    const recordCount = Number(rows[0]?.count ?? 0)
    if (recordCount === 0) {
      return {
        organizationId: input.organizationId,
        created: false,
        skipped: true,
        reason: 'no-blueprint-records',
      }
    }

    const release = await this.loadRelease(input.packageId, input.organizationId)
    const existing = await this.installations.findOne({
      where: { organizationId: input.organizationId, appKey: release.appKey },
    })
    if (existing) {
      return {
        organizationId: input.organizationId,
        created: false,
        skipped: false,
        needsUpgrade: existing.blueprintVersion !== release.version,
        installation: existing,
        release,
      }
    }
    if (input.dryRun) {
      return {
        organizationId: input.organizationId,
        created: false,
        skipped: false,
        wouldCreate: true,
        release,
      }
    }

    const installation = await this.install(
      {
        organizationId: input.organizationId,
        packageId: input.packageId,
        userId: input.userId,
        actor: input.actor,
        deploymentProfile: input.deploymentProfile,
      },
      release,
    )
    return {
      organizationId: input.organizationId,
      created: true,
      skipped: false,
      installation,
      release,
    }
  }

  async upgrade(input: {
    id: string
    organizationId: string
    packageId: string
    userId: string
    actor: string
    backup?: boolean
  }): Promise<BusinessAppInstallation> {
    const current = await this.findForOrganization(input.id, input.organizationId)
    if (current.status !== 'active') {
      throw new ConflictException('只有 active 应用可以升级')
    }

    const release = await this.loadRelease(input.packageId, input.organizationId)
    if (release.appKey !== current.appKey) {
      throw new BadRequestException(
        `发布属于应用 ${release.appKey}，不能升级应用 ${current.appKey}`,
      )
    }
    if (!semverGt(release.version, current.blueprintVersion)) {
      throw new ConflictException(
        `升级版本 ${release.version} 必须高于当前版本 ${current.blueprintVersion}；回退请走 rollback`,
      )
    }

    if (this.dataSource && this.lifecycle) {
      const currentRevision = await this.findCurrentRevision(current)
      const currentPackageId =
        currentRevision?.packageId ??
        `${current.blueprintId}-${current.blueprintVersion}`
      const compatibility = await this.checkUpgradeCompatibility({
        organizationId: input.organizationId,
        blueprintId: current.blueprintId,
        currentPackageId,
        targetPackageId: input.packageId,
      })
      if (!compatibility.ok) {
        throw new ConflictException(
          `升级数据不兼容：${compatibility.errors.join('；')}`,
        )
      }
      if (input.backup !== false) {
        await this.createUpgradeBackup({
          installation: current,
          fromPackageId: currentPackageId,
          toPackageId: input.packageId,
          fromVersion: current.blueprintVersion,
          toVersion: release.version,
          userId: input.userId,
        })
      }
    }

    const saved = await this.commitReleaseChange({
      current,
      release,
      action: 'upgraded',
      userId: input.userId,
    })
    await this.audit(input.organizationId, input.actor, 'business_app.upgrade', saved, {
      packageId: input.packageId,
      previousVersion: current.blueprintVersion,
      previousReleaseDigest: current.releaseDigest,
    })
    return saved
  }

  async rollback(input: {
    id: string
    organizationId: string
    revisionId?: string
    userId: string
    actor: string
  }): Promise<BusinessAppInstallation> {
    const current = await this.findForOrganization(input.id, input.organizationId)
    if (current.status !== 'active') {
      throw new ConflictException('只有 active 应用可以回滚')
    }

    const target = await this.findRollbackTarget(current, input.revisionId)
    if (target.releaseDigest === current.releaseDigest) {
      throw new ConflictException('目标修订已经是当前运行版本')
    }

    const release = await this.loadRelease(target.packageId, input.organizationId)
    assertReleaseMatches(target, release)
    const saved = await this.commitReleaseChange({
      current,
      release,
      action: 'rollback',
      userId: input.userId,
    })
    await this.audit(input.organizationId, input.actor, 'business_app.rollback', saved, {
      packageId: target.packageId,
      targetRevisionId: target.id,
      previousVersion: current.blueprintVersion,
      previousReleaseDigest: current.releaseDigest,
    })
    return saved
  }

  async listUpgradeBackups(id: string, organizationId: string) {
    const installation = await this.findForOrganization(id, organizationId)
    const backups = installation.config?.upgradeBackups
    return Array.isArray(backups) ? backups : []
  }

  async restoreUpgradeBackup(input: {
    id: string
    organizationId: string
    backupId: string
    userId: string
    actor: string
  }) {
    if (!this.lifecycle) {
      throw new BadRequestException('未配置 RecordLifecycleService，无法恢复升级备份')
    }
    const installation = await this.findForOrganization(input.id, input.organizationId)
    const backups = Array.isArray(installation.config?.upgradeBackups)
      ? (installation.config.upgradeBackups as Array<Record<string, unknown>>)
      : []
    const backup = backups.find((item) => item.id === input.backupId)
    if (!backup) throw new NotFoundException('升级备份不存在')
    const snapshots = Array.isArray(backup.snapshots)
      ? (backup.snapshots as Array<{ snapshotId: string }>)
      : []
    for (const snapshot of snapshots) {
      await this.lifecycle.restoreSnapshot({
        snapshotId: snapshot.snapshotId,
        organizationId: input.organizationId,
        actor: { id: input.userId, permissions: ['record:snapshot'] },
      })
    }
    backup.restoredAt = new Date().toISOString()
    backup.restoredBy = input.userId
    installation.config = {
      ...(installation.config ?? {}),
      upgradeBackups: backups,
    }
    await this.installations.save(installation)
    await this.audit(
      input.organizationId,
      input.actor,
      'business_app.upgrade_restore',
      installation,
      { backupId: input.backupId, restored: snapshots.length },
    )
    return { backup, restored: snapshots.length }
  }

  private async findCurrentRevision(
    installation: BusinessAppInstallation,
  ): Promise<BusinessAppInstallationRevision | null> {
    if (!installation.currentRevisionId) return null
    return this.revisions.findOne({
      where: {
        id: installation.currentRevisionId,
        organizationId: installation.organizationId,
        appInstallationId: installation.id,
      },
    })
  }

  private async checkUpgradeCompatibility(input: {
    organizationId: string
    blueprintId: string
    currentPackageId: string
    targetPackageId: string
  }) {
    const current = await this.blueprints.load(input.currentPackageId, {
      tenantId: input.organizationId,
    })
    const target = await this.blueprints.load(input.targetPackageId, {
      tenantId: input.organizationId,
    })
    const records = (await this.dataSource!.query(
      `SELECT entity, data, state
         FROM public.blueprint_records
        WHERE "organizationId" = $1 AND "blueprintId" = $2 AND "archivedAt" IS NULL`,
      [input.organizationId, input.blueprintId],
    )) as Array<{ entity: string; data: Record<string, unknown>; state: string | null }>
    return checkAppUpgradeCompatibility({
      current: current.compiled.template.entities,
      target: target.compiled.template.entities,
      records,
    })
  }

  private async createUpgradeBackup(input: {
    installation: BusinessAppInstallation
    fromPackageId: string
    toPackageId: string
    fromVersion: string
    toVersion: string
    userId: string
  }) {
    const records = (await this.dataSource!.query(
      `SELECT id, entity
         FROM public.blueprint_records
        WHERE "organizationId" = $1 AND "blueprintId" = $2 AND "archivedAt" IS NULL
        ORDER BY entity, id`,
      [input.installation.organizationId, input.installation.blueprintId],
    )) as Array<{ id: string; entity: string }>
    const snapshots: Array<{ recordId: string; entity: string; snapshotId: string }> = []
    for (const record of records) {
      const snapshot = await this.lifecycle!.snapshot({
        packageId: input.fromPackageId,
        entity: record.entity,
        recordId: record.id,
        organizationId: input.installation.organizationId,
        actor: { id: input.userId, permissions: ['record:snapshot'] },
        label: `app-upgrade:${input.fromVersion}->${input.toVersion}`,
        reason: 'app-upgrade-backup',
      })
      snapshots.push({
        recordId: record.id,
        entity: record.entity,
        snapshotId: snapshot.id,
      })
    }
    const backup = {
      id: randomUUID(),
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      fromPackageId: input.fromPackageId,
      toPackageId: input.toPackageId,
      createdAt: new Date().toISOString(),
      recordCount: snapshots.length,
      snapshots,
    }
    const existing = Array.isArray(input.installation.config?.upgradeBackups)
      ? (input.installation.config.upgradeBackups as unknown[])
      : []
    input.installation.config = {
      ...(input.installation.config ?? {}),
      upgradeBackups: [...existing.slice(-4), backup],
    }
    await this.installations.save(input.installation)
    return backup
  }

  async listRevisions(
    id: string,
    organizationId: string,
  ): Promise<BusinessAppInstallationRevision[]> {
    await this.findForOrganization(id, organizationId)
    return this.revisions.find({
      where: { organizationId, appInstallationId: id },
      order: { createdAt: 'ASC' },
    })
  }

  async suspend(
    id: string,
    organizationId: string,
    actor: string,
  ): Promise<BusinessAppInstallation> {
    return this.changeStatus(id, organizationId, actor, 'suspended', 'business_app.suspend')
  }

  async activate(
    id: string,
    organizationId: string,
    actor: string,
  ): Promise<BusinessAppInstallation> {
    return this.changeStatus(id, organizationId, actor, 'active', 'business_app.activate')
  }

  /**
   * 卸载：默认进入 uninstalling 并保留 retentionDays；purge=true 时立即标记 removed，
   * 仍保留行供审计，retention cleanup 再物理删除。
   */
  async uninstall(input: {
    id: string
    organizationId: string
    actor: string
    userId: string
    retentionDays?: number
    purge?: boolean
  }): Promise<BusinessAppInstallation> {
    const current = await this.findForOrganization(input.id, input.organizationId)
    if (current.status === 'removed' || current.status === 'uninstalling') return current

    const now = new Date()
    const retentionDays = Math.max(0, Number(input.retentionDays ?? 30))
    const retentionUntil = new Date(
      now.getTime() + (input.purge ? 0 : retentionDays * 24 * 60 * 60 * 1000),
    )
    const release: LoadedAppRelease = {
      packageId: `${current.blueprintId}-${current.blueprintVersion}`,
      appKey: current.appKey,
      version: current.blueprintVersion,
      releaseDigest: current.releaseDigest,
      runtimeRequirement: current.runtimeRequirement,
      license: current.license,
    }

    const saved = await this.installations.manager.transaction(async (manager) => {
      const appRepo = manager.getRepository(BusinessAppInstallation)
      const revisionRepo = manager.getRepository(BusinessAppInstallationRevision)
      const locked = await appRepo.findOne({
        where: { id: current.id, organizationId: current.organizationId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!locked) throw new NotFoundException('应用不存在')
      const previous = await this.ensureCurrentRevision(manager, locked)
      const revision = await revisionRepo.save(
        revisionRepo.create(
          this.revisionData(locked, release, 'uninstalled', previous?.id ?? null, input.userId),
        ),
      )
      locked.status = input.purge ? 'removed' : 'uninstalling'
      locked.config = {
        ...(locked.config ?? {}),
        uninstalledAt: now.toISOString(),
        retentionUntil: retentionUntil.toISOString(),
        purgeOnUninstall: input.purge === true,
      }
      locked.currentRevisionId = revision.id
      return appRepo.save(locked)
    })
    await this.audit(input.organizationId, input.actor, 'business_app.uninstall', saved, {
      retentionDays,
      purge: input.purge === true,
      retentionUntil: retentionUntil.toISOString(),
    })
    return saved
  }

  /** 保留期清理：删除已到期的 uninstalling/removed 安装及修订。 */
  async cleanupRemoved(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<{ removed: number }> {
    this.requireOrganization(organizationId)
    const rows = await this.installations.find({
      where: { organizationId, status: In(['uninstalling', 'removed']) },
    })
    let removed = 0
    for (const row of rows) {
      const until = row.config?.retentionUntil
      if (typeof until === 'string' && new Date(until).getTime() > now.getTime()) continue
      await this.installations.manager.transaction(async (manager) => {
        await manager.getRepository(BusinessAppInstallationRevision).delete({
          organizationId,
          appInstallationId: row.id,
        })
        await manager.getRepository(BusinessAppInstallation).delete({
          id: row.id,
          organizationId,
        })
      })
      await this.audit(organizationId, 'system:retention', 'business_app.retention_purge', row, {
        appKey: row.appKey,
        retentionUntil: until ?? null,
      })
      removed += 1
    }
    return { removed }
  }

  /**
   * 从 active installation 解析导航/路由元数据（3.4b）。
   *
   * 真源是该安装当前 release 的 `ui.json`（编译后的 `compiled.ui`），
   * 不是租户级 menu_items；菜单按用户功能权限过滤，路由返回页面声明。
   */
  async navigationForInstallation(
    id: string,
    organizationId: string,
    grantedPermissions: readonly string[],
  ): Promise<{
    installation: {
      id: string
      appKey: string
      blueprintId: string
      blueprintVersion: string
      releaseDigest: string
      status: string
      deploymentProfile: string
    }
    source: 'blueprint-ui' | 'none'
    navigation: Array<{
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
    effectivePermissions: string[]
  }> {
    const installation = await this.resolveActiveForOrganization(id, organizationId)
    const currentRevision = await this.findCurrentRevision(installation)
    const packageId =
      currentRevision?.packageId ??
      `${installation.blueprintId}-${installation.blueprintVersion}`
    const loaded = await this.blueprints.load(packageId, {
      tenantId: organizationId,
    })
    const ui = loaded.compiled?.ui
    const permissions = [...new Set(grantedPermissions)]
    const wildcard =
      permissions.includes('*') ||
      permissions.includes('system:manage') ||
      permissions.includes('system:admin')
    const visibleMenus = (ui?.menus ?? [])
      .filter(
        (menu) =>
          wildcard ||
          !menu.permissions ||
          menu.permissions.length === 0 ||
          menu.permissions.some((permission) => permissions.includes(permission)),
      )
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    return {
      installation: {
        id: installation.id,
        appKey: installation.appKey,
        blueprintId: installation.blueprintId,
        blueprintVersion: installation.blueprintVersion,
        releaseDigest: installation.releaseDigest,
        status: installation.status,
        deploymentProfile: installation.deploymentProfile,
      },
      source: ui ? 'blueprint-ui' : 'none',
      navigation: visibleMenus.map((menu) => ({
        identifier: menu.identifier,
        label: menu.label,
        path: menu.path,
        icon: menu.icon,
        order: menu.order ?? 0,
        permissions: menu.permissions ?? [],
      })),
      routes: (ui?.pages ?? []).map((page) => ({
        identifier: page.identifier,
        label: page.label,
        type: page.type,
        entity: page.entity,
        route: page.route,
        fields: page.fields ?? [],
      })),
      effectivePermissions: permissions,
    }
  }

  async resolveExecutionContext(input: {
    installationId: string
    organizationId: string
    userId: string
    grantedPermissions: readonly string[]
  }): Promise<BusinessAppExecutionContext> {
    const installation = await this.resolveActiveForOrganization(
      input.installationId,
      input.organizationId,
    )
    const appRolePermissions = this.appRoles
      ? (
          await this.appRoles.find({
            where: {
              organizationId: installation.organizationId,
              appKey: installation.appKey,
              status: 'active',
            },
          })
        ).flatMap((role) => role.permissions ?? [])
      : []
    return {
      organizationId: installation.organizationId,
      appInstallationId: installation.id,
      appKey: installation.appKey,
      userId: input.userId,
      grantedPermissions: [
        ...new Set([...input.grantedPermissions, ...appRolePermissions]),
      ],
      runtimeProfile: installation.deploymentProfile,
      traceId: randomUUID(),
    }
  }

  toView(installation: BusinessAppInstallation): BusinessAppInstallationView {
    return {
      id: installation.id,
      organizationId: installation.organizationId,
      appKey: installation.appKey,
      displayName: installation.displayName,
      slug: installation.slug,
      blueprintId: installation.blueprintId,
      blueprintVersion: installation.blueprintVersion,
      releaseDigest: installation.releaseDigest,
      runtimeRequirement: installation.runtimeRequirement,
      deploymentProfile: installation.deploymentProfile,
      status: installation.status,
      config: installation.config ?? {},
      license: installation.license ?? null,
      currentRevisionId: installation.currentRevisionId ?? null,
      createdById: installation.createdById ?? null,
      createdAt: installation.createdAt.toISOString(),
      updatedAt: installation.updatedAt.toISOString(),
    }
  }

  toRevisionView(
    revision: BusinessAppInstallationRevision,
  ): BusinessAppRevisionView {
    return {
      id: revision.id,
      organizationId: revision.organizationId,
      appInstallationId: revision.appInstallationId,
      previousRevisionId: revision.previousRevisionId ?? null,
      packageId: revision.packageId,
      blueprintId: revision.blueprintId,
      blueprintVersion: revision.blueprintVersion,
      releaseDigest: revision.releaseDigest,
      runtimeRequirement: revision.runtimeRequirement,
      action: revision.action,
      config: revision.config ?? {},
      license: revision.license ?? null,
      createdById: revision.createdById ?? null,
      createdAt: revision.createdAt.toISOString(),
    }
  }

  private async loadRelease(
    packageId: string,
    organizationId: string,
  ): Promise<LoadedAppRelease> {
    const loaded = await this.blueprints.load(packageId, { tenantId: organizationId })
    return {
      packageId,
      appKey: loaded.manifest.blueprint,
      version: loaded.manifest.version,
      releaseDigest: loaded.plan.irDigest,
      runtimeRequirement: loaded.manifest.runtime,
      license: loaded.license
        ? {
            issuer: loaded.license.issuer,
            ...(loaded.license.expiresAt ? { expiresAt: loaded.license.expiresAt } : {}),
          }
        : null,
    }
  }

  private async findRollbackTarget(
    current: BusinessAppInstallation,
    requestedRevisionId?: string,
  ): Promise<BusinessAppInstallationRevision> {
    if (requestedRevisionId) {
      const requested = await this.revisions.findOne({
        where: {
          id: requestedRevisionId,
          organizationId: current.organizationId,
          appInstallationId: current.id,
        },
      })
      if (!requested) throw new NotFoundException('目标应用修订不存在')
      return requested
    }

    if (!current.currentRevisionId) {
      throw new ConflictException('当前应用没有可追踪的修订历史，不能回滚')
    }
    const currentRevision = await this.revisions.findOne({
      where: {
        id: current.currentRevisionId,
        organizationId: current.organizationId,
        appInstallationId: current.id,
      },
    })
    if (!currentRevision?.previousRevisionId) {
      throw new ConflictException('当前应用没有上一修订可回滚')
    }
    const previous = await this.revisions.findOne({
      where: {
        id: currentRevision.previousRevisionId,
        organizationId: current.organizationId,
        appInstallationId: current.id,
      },
    })
    if (!previous) throw new NotFoundException('上一应用修订不存在')
    return previous
  }

  private async commitReleaseChange(input: {
    current: BusinessAppInstallation
    release: LoadedAppRelease
    action: Exclude<BusinessAppRevisionAction, 'installed'>
    userId: string
  }): Promise<BusinessAppInstallation> {
    const expectedRevisionId = input.current.currentRevisionId ?? null
    return this.installations.manager.transaction(async (manager) => {
      const appRepo = manager.getRepository(BusinessAppInstallation)
      const revisionRepo = manager.getRepository(BusinessAppInstallationRevision)
      const locked = await appRepo.findOne({
        where: {
          id: input.current.id,
          organizationId: input.current.organizationId,
        },
        lock: { mode: 'pessimistic_write' },
      })
      if (!locked) throw new NotFoundException('应用不存在')
      if ((locked.currentRevisionId ?? null) !== expectedRevisionId) {
        throw new ConflictException('应用修订已变化，请刷新后重试')
      }

      const previous = await this.ensureCurrentRevision(manager, locked)
      const revision = await revisionRepo.save(
        revisionRepo.create(
          this.revisionData(
            locked,
            input.release,
            input.action,
            previous?.id ?? null,
            input.userId,
          ),
        ),
      )
      locked.blueprintId = input.release.appKey
      locked.blueprintVersion = input.release.version
      locked.releaseDigest = input.release.releaseDigest
      locked.runtimeRequirement = input.release.runtimeRequirement
      locked.license = input.release.license
      locked.currentRevisionId = revision.id
      return appRepo.save(locked)
    })
  }

  private async ensureCurrentRevision(
    manager: EntityManager,
    installation: BusinessAppInstallation,
  ): Promise<BusinessAppInstallationRevision | null> {
    if (!installation.currentRevisionId) return null
    const revisionRepo = manager.getRepository(BusinessAppInstallationRevision)
    const existing = await revisionRepo.findOne({
      where: {
        id: installation.currentRevisionId,
        organizationId: installation.organizationId,
        appInstallationId: installation.id,
      },
    })
    if (!existing) {
      throw new ConflictException('当前应用修订指针失效，拒绝继续修改')
    }
    return existing
  }

  private revisionData(
    installation: BusinessAppInstallation,
    release: LoadedAppRelease,
    action: BusinessAppRevisionAction,
    previousRevisionId: string | null,
    userId: string,
  ): Partial<BusinessAppInstallationRevision> {
    return {
      organizationId: installation.organizationId,
      appInstallationId: installation.id,
      previousRevisionId,
      packageId: release.packageId,
      blueprintId: release.appKey,
      blueprintVersion: release.version,
      releaseDigest: release.releaseDigest,
      runtimeRequirement: release.runtimeRequirement,
      action,
      config: installation.config ?? {},
      license: release.license,
      createdById: userId,
    }
  }

  private async changeStatus(
    id: string,
    organizationId: string,
    actor: string,
    status: 'active' | 'suspended',
    action: string,
  ): Promise<BusinessAppInstallation> {
    const installation = await this.findForOrganization(id, organizationId)
    if (installation.status === status) return installation

    installation.status = status
    const saved = await this.installations.save(installation)
    await this.audit(organizationId, actor, action, saved)
    return saved
  }

  private requireOrganization(organizationId: string): void {
    if (!organizationId) {
      throw new BadRequestException('缺少组织上下文（organizationId）')
    }
  }

  private async audit(
    organizationId: string,
    actor: string,
    action: string,
    installation: BusinessAppInstallation,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditLogs.create({
      action,
      resource: 'business-app',
      resourceId: installation.id,
      actor,
      status: 'success',
      organizationId,
      metadata: {
        appKey: installation.appKey,
        blueprintId: installation.blueprintId,
        blueprintVersion: installation.blueprintVersion,
        releaseDigest: installation.releaseDigest,
        currentRevisionId: installation.currentRevisionId,
        status: installation.status,
        ...metadata,
      },
    })
  }
}

function displayNameOf(appKey: string): string {
  return appKey
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function assertReleaseMatches(
  revision: BusinessAppInstallationRevision,
  release: LoadedAppRelease,
): void {
  if (
    revision.blueprintId !== release.appKey ||
    revision.blueprintVersion !== release.version ||
    revision.releaseDigest !== release.releaseDigest
  ) {
    throw new ConflictException(
      '目标修订对应的 Blueprint 发布已变化或不可复现，拒绝回滚',
    )
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505',
  )
}
