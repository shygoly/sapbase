import { ConflictException } from '@nestjs/common'
import { BlueprintReleasesService } from './blueprint-releases.service'

const DIGEST = `sha256:${'a'.repeat(64)}`

function setup() {
  const rows: any[] = []
  const repository = {
    findOne: jest.fn(async ({ where }: any) =>
      rows.find((row) =>
        where.id !== undefined
          ? row.id === where.id && row.organizationId === where.organizationId
          : row.organizationId === where.organizationId &&
            row.blueprintId === where.blueprintId &&
            row.version === where.version,
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `release-${rows.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      rows.push(row)
      return row
    }),
    find: jest.fn(async ({ where }: any) =>
      rows.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (where.blueprintId === undefined ||
            row.blueprintId === where.blueprintId),
      ),
    ),
  }
  const audit = { create: jest.fn(async () => ({})) }
  const service = new BlueprintReleasesService(
    repository as never,
    audit as never,
  )
  return { service, repository, audit, rows }
}

describe('BlueprintReleasesService', () => {
  it('登记不可变 release；同版本同摘要幂等返回', async () => {
    const { service, rows, audit } = setup()
    const first = await service.register({
      organizationId: 'org-1',
      blueprintId: 'erp',
      version: '1.0.0',
      packageId: 'erp-1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
      createdById: 'u1',
    })
    expect(first).toMatchObject({
      blueprintId: 'erp',
      version: '1.0.0',
      releaseDigest: DIGEST,
      trustStatus: 'verified',
    })
    const again = await service.register({
      organizationId: 'org-1',
      blueprintId: 'erp',
      version: '1.0.0',
      packageId: 'erp-1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
    })
    expect(again.id).toBe(first.id)
    expect(rows).toHaveLength(1)
    expect(audit.create).toHaveBeenCalledTimes(1)
  })

  it('同组织同 blueprintId/version 不同摘要 → Conflict（不可替换）', async () => {
    const { service } = setup()
    await service.register({
      organizationId: 'org-1',
      blueprintId: 'erp',
      version: '1.0.0',
      packageId: 'erp-1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '>=1.0.0 <2.0.0',
    })
    await expect(
      service.register({
        organizationId: 'org-1',
        blueprintId: 'erp',
        version: '1.0.0',
        packageId: 'erp-1.0.0-repacked',
        releaseDigest: `sha256:${'b'.repeat(64)}`,
        runtimeRequirement: '>=1.0.0 <2.0.0',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('非法摘要拒绝；list/findById 按组织', async () => {
    const { service } = setup()
    await expect(
      service.register({
        organizationId: 'org-1',
        blueprintId: 'erp',
        version: '1.0.0',
        packageId: 'erp-1.0.0',
        releaseDigest: 'not-a-digest',
        runtimeRequirement: '*',
      }),
    ).rejects.toThrow(/sha256/)
    const release = await service.register({
      organizationId: 'org-1',
      blueprintId: 'crm',
      version: '1.0.0',
      packageId: 'crm-1.0.0',
      releaseDigest: DIGEST,
      runtimeRequirement: '*',
    })
    await expect(service.list('org-1', 'crm')).resolves.toHaveLength(1)
    await expect(service.findById('org-1', release.id)).resolves.toMatchObject({
      blueprintId: 'crm',
    })
  })
})
