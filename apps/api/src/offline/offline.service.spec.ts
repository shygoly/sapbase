import { ConflictException } from '@nestjs/common'
import { OfflineService } from './offline.service'

function setup(options: { assets?: any[]; variants?: any[]; packages?: any[]; devices?: any[]; entitlements?: any[] } = {}) {
  const packages: any[] = options.packages ?? []
  const devices: any[] = options.devices ?? []
  const entitlements: any[] = options.entitlements ?? []
  const repo = (rows: any[], prefix: string) => ({
    findOne: jest.fn(async ({ where }: any) =>
      rows.find((row) =>
        Object.entries(where).every(([key, value]) => value === undefined || row[key] === value),
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any = {}) =>
      rows.filter((row) =>
        Object.entries(where ?? {}).every(([key, value]) => value === undefined || row[key] === value),
      ),
    ),
    save: jest.fn(async (row) => {
      const saved = row.id ? row : { id: `${prefix}-${rows.length + 1}`, ...row }
      const index = rows.findIndex((item) => item.id === saved.id)
      if (index >= 0) rows[index] = saved
      else rows.push(saved)
      return saved
    }),
    create: jest.fn((row) => row),
    update: jest.fn(async () => ({ affected: 0 })),
  })
  const dataSource = { query: jest.fn(async () => []) }
  const storage = { get: jest.fn(async () => Buffer.from('asset')) }
  const auditLogs = { create: jest.fn(async () => ({})) }
  return {
    service: new OfflineService(
      repo(packages, 'pkg') as never,
      repo(entitlements, 'ent') as never,
      repo(devices, 'dev') as never,
      repo(options.assets ?? [], 'asset') as never,
      repo(options.variants ?? [], 'var') as never,
      dataSource as never,
      storage as never,
      auditLogs as never,
    ),
    packages,
    devices,
    entitlements,
    dataSource,
    storage,
    auditLogs,
  }
}

const asset = {
  id: 'asset-1',
  organizationId: 'org-1',
  objectKey: 'org/org-1/a.mp4',
  mimeType: 'video/mp4',
  size: '1024',
  checksum: 'sha256:abc',
  status: 'ready',
  deletedAt: null,
}

describe('OfflineService', () => {
  it('创建包：manifest 校验和 + Ed25519 签名可验证；篡改失败', async () => {
    const { service, packages } = setup({ assets: [asset] })
    const created = await service.createPackage('org-1', { id: 'u1' }, {
      key: 'course.v1',
      title: '课程离线包',
      assets: [{ assetId: 'asset-1' }],
      publish: true,
    })
    expect(created.status).toBe('published')
    expect(created.manifest.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(created.signature).toBeTruthy()
    expect(service.verifyManifest(created.manifest, created.signature as string)).toBe(true)
    const tampered = { ...created.manifest, title: 'tampered' }
    expect(service.verifyManifest(tampered, created.signature as string)).toBe(false)
    expect(packages).toHaveLength(1)
  })

  it('设备上限：超过 OFFLINE_MAX_DEVICES 拒绝', async () => {
    process.env.OFFLINE_MAX_DEVICES = '1'
    const { service } = setup({
      devices: [{ id: 'd1', organizationId: 'org-1', userId: 'u1', deviceId: 'old', status: 'active' }],
    })
    await expect(
      service.registerDevice('org-1', 'u1', { deviceId: 'new' }),
    ).rejects.toBeInstanceOf(ConflictException)
    delete process.env.OFFLINE_MAX_DEVICES
  })

  it('manifestForUser：授权有效才返回短期令牌；撤销后拒绝', async () => {
    const pkg = await (async () => {
      const { service } = setup({ assets: [asset] })
      return service.createPackage('org-1', { id: 'admin' }, {
        key: 'course.v1',
        title: '课程',
        assets: [{ assetId: 'asset-1' }],
        publish: true,
      })
    })()
    const { service } = setup({
      assets: [asset],
      packages: [pkg],
      devices: [{ id: 'd1', organizationId: 'org-1', userId: 'u1', deviceId: 'dev-1', status: 'active' }],
      entitlements: [
        {
          id: 'e1',
          organizationId: 'org-1',
          packageId: pkg.id,
          userId: 'u1',
          deviceId: 'dev-1',
          status: 'active',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    })
    const result = await service.manifestForUser('org-1', 'u1', pkg.id, 'dev-1')
    const items = (result.manifest as any).items
    expect(items[0].downloadToken).toBeTruthy()
    expect(items[0].downloadUrl).toContain('/api/offline/download/')

    const revoked = await service.revokeEntitlementsBy('org-1', { id: 'admin' }, { userId: 'u1' })
    expect(revoked.revoked).toBe(0)
    await expect(service.manifestForUser('org-1', 'u2', pkg.id, 'dev-1')).rejects.toThrow()
  })

  it('AI 内容缺标识 → 拒绝创建离线包', async () => {
    const { service, dataSource } = setup({ assets: [asset] })
    ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (String(sql).includes('ai_content_provenance')) return [{ '?column?': 1 }]
      return []
    })
    await expect(
      service.createPackage('org-1', { id: 'u1' }, {
        key: 'ai.course',
        title: 'AI 课程',
        assets: [{ assetId: 'asset-1' }],
        publish: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})
