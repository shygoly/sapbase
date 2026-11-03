import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import semverGt = require('semver/functions/gt')
import { EntityManager, Repository } from 'typeorm'
import type {
  BusinessAppDeploymentProfile,
  BusinessAppExecutionContext,
  BusinessAppInstallation as BusinessAppInstallationView,
  BusinessAppInstallationRevision as BusinessAppRevisionView,
  BusinessAppLicenseBinding,
  BusinessAppRevisionAction,
} from '@speckit/shared-schemas'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
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

interface LoadedAppRelease {
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

  async install(input: InstallBusinessAppInput): Promise<BusinessAppInstallation> {
    this.requireOrganization(input.organizationId)
    if (!input.packageId) throw new BadRequestException('缺少 Blueprint 包 id')
    if (!input.userId) throw new BadRequestException('缺少安装用户身份')

    const release = await this.loadRelease(input.packageId, input.organizationId)
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

  async upgrade(input: {
    id: string
    organizationId: string
    packageId: string
    userId: string
    actor: string
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
    return {
      organizationId: installation.organizationId,
      appInstallationId: installation.id,
      appKey: installation.appKey,
      userId: input.userId,
      grantedPermissions: [...input.grantedPermissions],
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
