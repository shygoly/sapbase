import { ConflictException } from '@nestjs/common'
import { Validator } from 'jsonschema'
import { BUSINESS_APP_INSTALLATION_PROTOCOL } from '@speckit/shared-schemas'
import { loadSchema } from '../common/protocol/schema-loader'
import { BusinessAppInstallationRevision } from './business-app-installation-revision.entity'
import { BusinessAppInstallation } from './business-app-installation.entity'
import { BusinessAppsService } from './business-apps.service'

const ORG = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const APP_ID = '33333333-3333-4333-8333-333333333333'
const DIGEST = `sha256:${'a'.repeat(64)}`

function loadedBlueprint(version = '1.0.0', digest = DIGEST) {
  return {
    manifest: {
      blueprint: 'erp',
      version,
      runtime: '>=1.0.0 <2.0.0',
    },
    plan: { irDigest: digest },
    license: {
      issuer: 'sapbase-platform',
      expiresAt: '2027-01-01T00:00:00Z',
    },
  }
}

function harness(
  existing?: Record<string, any> | null,
  releases: Array<{ packageId: string; loaded: ReturnType<typeof loadedBlueprint> }> = [
    { packageId: 'erp-1.0.0', loaded: loadedBlueprint() },
  ],
) {
  const appRows = existing ? [withEntityDefaults(existing)] : []
  const revisionRows: Array<Record<string, any>> = []
  let revisionSeq = 1

  const appRepository = {
    manager: undefined as any,
    findOne: jest.fn(async (options?: { where?: Record<string, unknown> }) => {
      const where = options?.where ?? {}
      return (
        appRows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) ?? null
      )
    }),
    find: jest.fn(async () => appRows),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      for (let index = appRows.length - 1; index >= 0; index -= 1) {
        if (Object.entries(where).every(([key, value]) => appRows[index][key] === value)) {
          appRows.splice(index, 1)
        }
      }
      return { affected: 1 }
    }),
    create: jest.fn((row: Record<string, unknown>) => ({ ...row })),
    save: jest.fn(async (row: Record<string, any>) => {
      const saved = {
        ...row,
        id: row.id ?? APP_ID,
        createdAt: row.createdAt ?? new Date('2026-10-18T00:00:00Z'),
        updatedAt: new Date('2026-10-18T00:00:00Z'),
      }
      const index = appRows.findIndex((item) => item.id === saved.id)
      if (index >= 0) appRows[index] = saved
      else appRows.push(saved)
      return saved
    }),
  }
  const revisionRepository = {
    create: jest.fn((row: Record<string, unknown>) => ({ ...row })),
    save: jest.fn(async (row: Record<string, any>) => {
      let id = row.id
      while (!id || revisionRows.some((item) => item.id === id)) {
        id = `revision-${revisionSeq++}`
      }
      const saved = {
        ...row,
        id,
        createdAt: row.createdAt ?? new Date('2026-10-18T00:00:00Z'),
        updatedAt: row.updatedAt ?? new Date('2026-10-18T00:00:00Z'),
      }
      revisionRows.push(saved)
      return saved
    }),
    findOne: jest.fn(async (options: { where?: Record<string, unknown> }) => {
      const where = options.where ?? {}
      return (
        revisionRows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) ?? null
      )
    }),
    find: jest.fn(async () => revisionRows),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      for (let index = revisionRows.length - 1; index >= 0; index -= 1) {
        if (Object.entries(where).every(([key, value]) => revisionRows[index][key] === value)) {
          revisionRows.splice(index, 1)
        }
      }
      return { affected: 1 }
    }),
  }
  appRepository.manager = {
    transaction: async <T>(run: (manager: any) => Promise<T>) =>
      run({
        getRepository: (entity: unknown) =>
          entity === BusinessAppInstallation ? appRepository : revisionRepository,
      }),
  }

  const blueprints = {
    load: jest.fn(async (packageId: string) => {
      const found = releases.find((item) => item.packageId === packageId)
      if (!found) throw new Error(`unknown package ${packageId}`)
      return found.loaded
    }),
  }
  const auditLogs = {
    create: jest.fn(async (row: Record<string, unknown>) => row),
  }
  return {
    service: new BusinessAppsService(
      appRepository as never,
      revisionRepository as never,
      blueprints as never,
      auditLogs as never,
    ),
    repository: appRepository,
    revisionRepository,
    appRows,
    revisionRows,
    blueprints,
    auditLogs,
  }
}

function withEntityDefaults(row: Record<string, any>): Record<string, any> {
  return {
    id: APP_ID,
    config: {},
    license: null,
    currentRevisionId: null,
    createdAt: new Date('2026-10-18T00:00:00Z'),
    updatedAt: new Date('2026-10-18T00:00:00Z'),
    ...row,
  }
}

describe('BusinessAppsService', () => {
  it('安装时从既有 Blueprint 装载链取得摘要，不信任客户端摘要', async () => {
    const { service, blueprints, auditLogs } = harness()
    const saved = await service.install({
      organizationId: ORG,
      packageId: 'erp-1.0.0',
      userId: USER,
      actor: 'admin@example.com',
    })

    expect(blueprints.load).toHaveBeenCalledWith('erp-1.0.0', { tenantId: ORG })
    expect(saved).toMatchObject({
      organizationId: ORG,
      appKey: 'erp',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      deploymentProfile: 'shared-saas',
      status: 'active',
    })
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'business_app.install',
        organizationId: ORG,
        resourceId: APP_ID,
      }),
    )
  })

  it('同一组织、同一发布重复安装是幂等的', async () => {
    const { service, repository, auditLogs } = harness({
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
    })

    const saved = await service.install({
      organizationId: ORG,
      packageId: 'erp-1.0.0',
      userId: USER,
      actor: 'admin@example.com',
    })

    expect(saved).toEqual(expect.objectContaining({ id: APP_ID }))
    expect(repository.save).not.toHaveBeenCalled()
    expect(auditLogs.create).not.toHaveBeenCalled()
  })

  it('同一 appKey 指向另一发布时拒绝静默升级', async () => {
    const { service } = harness({
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      blueprintVersion: '0.9.0',
      releaseDigest: `sha256:${'b'.repeat(64)}`,
    })

    await expect(
      service.install({
        organizationId: ORG,
        packageId: 'erp-1.0.0',
        userId: USER,
        actor: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('暂停后应用上下文不可再解析，恢复后再次可用', async () => {
    const row = {
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      deploymentProfile: 'shared-saas',
      status: 'active',
      config: {},
      license: null,
      createdById: USER,
      createdAt: new Date('2026-10-18T00:00:00Z'),
      updatedAt: new Date('2026-10-18T00:00:00Z'),
    }
    const { service, repository } = harness(row)
    repository.save.mockImplementation(async (saved: Record<string, unknown>) => saved as never)

    const suspended = await service.suspend(APP_ID, ORG, 'admin@example.com')
    expect(suspended.status).toBe('suspended')
    await expect(
      service.resolveExecutionContext({
        installationId: APP_ID,
        organizationId: ORG,
        userId: USER,
        grantedPermissions: [],
      }),
    ).rejects.toThrow(/不存在|停用/)

    await service.activate(APP_ID, ORG, 'admin@example.com')
    await expect(
      service.resolveExecutionContext({
        installationId: APP_ID,
        organizationId: ORG,
        userId: USER,
        grantedPermissions: ['tool:blueprint:read'],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId: ORG,
        appInstallationId: APP_ID,
        appKey: 'erp',
        userId: USER,
        runtimeProfile: 'shared-saas',
      }),
    )
  })

  it('卸载进入 uninstalling 并按保留期清理；上下文立即拒绝', async () => {
    const row = {
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      deploymentProfile: 'shared-saas',
      status: 'active',
      config: {},
      license: null,
      currentRevisionId: null,
      createdById: USER,
      createdAt: new Date('2026-10-18T00:00:00Z'),
      updatedAt: new Date('2026-10-18T00:00:00Z'),
    }
    const { service, revisionRows, appRows, auditLogs } = harness(row)
    const saved = await service.uninstall({
      id: APP_ID,
      organizationId: ORG,
      userId: USER,
      actor: 'admin@example.com',
      retentionDays: 7,
    })
    expect(saved.status).toBe('uninstalling')
    expect(saved.config.retentionUntil).toBeTruthy()
    expect(revisionRows.some((item) => item.action === 'uninstalled')).toBe(true)
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'business_app.uninstall' }),
    )
    await expect(
      service.resolveExecutionContext({
        installationId: APP_ID,
        organizationId: ORG,
        userId: USER,
        grantedPermissions: [],
      }),
    ).rejects.toThrow(/不存在|停用|尚未/)

    // 保留期到期后清理
    appRows[0].config = {
      ...appRows[0].config,
      retentionUntil: new Date(Date.now() - 60_000).toISOString(),
    }
    await expect(service.cleanupRemoved(ORG)).resolves.toEqual({ removed: 1 })
    expect(appRows).toHaveLength(0)
    expect(revisionRows).toHaveLength(0)
  })

  it('卸载 purge=true 立即标记 removed，仍等待 retention cleanup 物理删除', async () => {
    const row = {
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      deploymentProfile: 'shared-saas',
      status: 'active',
      config: {},
      license: null,
      currentRevisionId: null,
      createdById: USER,
      createdAt: new Date('2026-10-18T00:00:00Z'),
      updatedAt: new Date('2026-10-18T00:00:00Z'),
    }
    const { service, appRows } = harness(row)
    const saved = await service.uninstall({
      id: APP_ID,
      organizationId: ORG,
      userId: USER,
      actor: 'admin@example.com',
      purge: true,
    })
    expect(saved.status).toBe('removed')
    expect(appRows).toHaveLength(1)
  })

  it('升级追加修订并更新 currentRevisionId；降级必须走 rollback', async () => {
    const revision = {
      id: 'revision-1',
      organizationId: ORG,
      appInstallationId: APP_ID,
      packageId: 'erp-1.0.0',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      action: 'installed',
      config: {},
      license: null,
      previousRevisionId: null,
      createdAt: new Date('2026-10-18T00:00:00Z'),
    }
    const nextDigest = `sha256:${'d'.repeat(64)}`
    const { service, revisionRows } = harness(
      {
        id: APP_ID,
        organizationId: ORG,
        appKey: 'erp',
        blueprintId: 'erp',
        blueprintVersion: '1.0.0',
        releaseDigest: DIGEST,
        runtimeRequirement: '>=1.0.0 <2.0.0',
        deploymentProfile: 'shared-saas',
        status: 'active',
        currentRevisionId: 'revision-1',
      },
      [
        { packageId: 'erp-1.0.0', loaded: loadedBlueprint() },
        { packageId: 'erp-1.1.0', loaded: loadedBlueprint('1.1.0', nextDigest) },
      ],
    )
    revisionRows.push(revision)

    const upgraded = await service.upgrade({
      id: APP_ID,
      organizationId: ORG,
      packageId: 'erp-1.1.0',
      userId: USER,
      actor: 'admin@example.com',
    })
    expect(upgraded).toMatchObject({
      blueprintVersion: '1.1.0',
      releaseDigest: nextDigest,
      currentRevisionId: 'revision-2',
    })
    expect(revisionRows[1]).toMatchObject({
      action: 'upgraded',
      previousRevisionId: 'revision-1',
      packageId: 'erp-1.1.0',
    })

    await expect(
      service.upgrade({
        id: APP_ID,
        organizationId: ORG,
        packageId: 'erp-1.0.0',
        userId: USER,
        actor: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('回滚重新装载目标发布并追加 rollback 修订', async () => {
    const nextDigest = `sha256:${'d'.repeat(64)}`
    const { service, revisionRows } = harness(
      {
        id: APP_ID,
        organizationId: ORG,
        appKey: 'erp',
        blueprintId: 'erp',
        blueprintVersion: '1.1.0',
        releaseDigest: nextDigest,
        runtimeRequirement: '>=1.0.0 <2.0.0',
        deploymentProfile: 'shared-saas',
        status: 'active',
        currentRevisionId: 'revision-2',
      },
      [
        { packageId: 'erp-1.0.0', loaded: loadedBlueprint() },
        { packageId: 'erp-1.1.0', loaded: loadedBlueprint('1.1.0', nextDigest) },
      ],
    )
    revisionRows.push(
      {
        id: 'revision-1',
        organizationId: ORG,
        appInstallationId: APP_ID,
        packageId: 'erp-1.0.0',
        blueprintId: 'erp',
        blueprintVersion: '1.0.0',
        releaseDigest: DIGEST,
        runtimeRequirement: '>=1.0.0 <2.0.0',
        action: 'installed',
        config: {},
        license: null,
        previousRevisionId: null,
        createdAt: new Date('2026-10-18T00:00:00Z'),
      },
      {
        id: 'revision-2',
        organizationId: ORG,
        appInstallationId: APP_ID,
        packageId: 'erp-1.1.0',
        blueprintId: 'erp',
        blueprintVersion: '1.1.0',
        releaseDigest: nextDigest,
        runtimeRequirement: '>=1.0.0 <2.0.0',
        action: 'upgraded',
        config: {},
        license: null,
        previousRevisionId: 'revision-1',
        createdAt: new Date('2026-10-18T00:00:00Z'),
      },
    )

    const rolledBack = await service.rollback({
      id: APP_ID,
      organizationId: ORG,
      userId: USER,
      actor: 'admin@example.com',
    })
    expect(rolledBack).toMatchObject({
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      currentRevisionId: 'revision-3',
    })
    expect(revisionRows[2]).toMatchObject({
      action: 'rollback',
      previousRevisionId: 'revision-2',
      packageId: 'erp-1.0.0',
    })
  })

  it('toView 输出通过安装协议校验', () => {
    const { service } = harness()
    const view = service.toView({
      id: APP_ID,
      organizationId: ORG,
      appKey: 'erp',
      displayName: 'Erp',
      slug: 'erp',
      blueprintId: 'erp',
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      deploymentProfile: 'shared-saas',
      status: 'active',
      config: {},
      license: { issuer: 'sapbase-platform' },
      createdById: USER,
      createdAt: new Date('2026-10-18T00:00:00Z'),
      updatedAt: new Date('2026-10-18T00:00:00Z'),
    } as never)

    expect(BUSINESS_APP_INSTALLATION_PROTOCOL).toBe('business-app-installation/v1')
    const result = new Validator().validate(
      view,
      loadSchema('business-app-installation.schema.json'),
    )
    expect(result.errors).toEqual([])
  })
})

describe('business-app-installation schema', () => {
  const valid = {
    id: APP_ID,
    organizationId: ORG,
    appKey: 'erp',
    displayName: 'Erp',
    slug: 'erp',
    blueprintId: 'erp',
    blueprintVersion: '1.0.0',
    releaseDigest: DIGEST,
    runtimeRequirement: '>=1.0.0 <2.0.0',
    deploymentProfile: 'shared-saas',
    status: 'active',
    config: {},
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
  }

  it.each([
    ['非 sha256 摘要', { ...valid, releaseDigest: 'erp' }],
    ['未知部署剖面', { ...valid, deploymentProfile: 'local' }],
    ['未知生命周期', { ...valid, status: 'enabled' }],
    ['额外字段', { ...valid, trusted: true }],
  ])('拒绝：%s', (_label, value) => {
    const result = new Validator().validate(
      value,
      loadSchema('business-app-installation.schema.json'),
    )
    expect(result.valid).toBe(false)
  })
})

describe('business-app-installation-revision schema', () => {
  const valid = {
    id: '44444444-4444-4444-8444-444444444444',
    organizationId: ORG,
    appInstallationId: APP_ID,
    previousRevisionId: null,
    packageId: 'erp-1.0.0',
    blueprintId: 'erp',
    blueprintVersion: '1.0.0',
    releaseDigest: DIGEST,
    runtimeRequirement: '>=1.0.0 <2.0.0',
    action: 'installed',
    config: {},
    createdAt: '2026-10-18T00:00:00Z',
  }

  it('接受合法修订', () => {
    const result = new Validator().validate(
      valid,
      loadSchema('business-app-installation-revision.schema.json'),
    )
    expect(result.errors).toEqual([])
  })

  it.each([
    ['未知动作', { ...valid, action: 'patched' }],
    ['非法包 id', { ...valid, packageId: '../erp' }],
    ['非法摘要', { ...valid, releaseDigest: 'sha256:no' }],
  ])('拒绝：%s', (_label, value) => {
    const result = new Validator().validate(
      value,
      loadSchema('business-app-installation-revision.schema.json'),
    )
    expect(result.valid).toBe(false)
  })
})
