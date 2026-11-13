import { ForbiddenException } from '@nestjs/common'
import { SourceExportService } from './source-export.service'

const release = {
  id: 'release-1',
  organizationId: 'org-1',
  blueprintId: 'erp',
  version: '1.0.0',
  packageId: 'erp-1.0.0',
  releaseDigest: `sha256:${'a'.repeat(64)}`,
} as any

function setup() {
  const audit = { create: jest.fn(async () => ({})) }
  const service = new SourceExportService(audit as never)
  return { service, audit }
}

describe('SourceExportService', () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env = { ...original }
  })

  it('未配置 source-export license → 403，且写拒绝审计', async () => {
    delete process.env.SOURCE_EXPORT_LICENSE_ID
    const { service, audit } = setup()
    await expect(
      service.plan(release, { organizationId: 'org-1', actor: 'admin@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_export.denied',
        status: 'failure',
        metadata: expect.objectContaining({ reasons: expect.any(Array) }),
      }),
    )
  })

  it('许可过期 → 403', async () => {
    process.env.SOURCE_EXPORT_LICENSE_ID = 'license-1'
    process.env.SOURCE_EXPORT_LICENSE_EXPIRES_AT = '2020-01-01T00:00:00Z'
    const { service } = setup()
    await expect(
      service.plan(release, { organizationId: 'org-1', actor: 'admin@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('许可有效但生成器未配置 → 只返回计划，不声称可交付源码', async () => {
    process.env.SOURCE_EXPORT_LICENSE_ID = 'license-1'
    process.env.SOURCE_EXPORT_LICENSE_EXPIRES_AT = '2030-01-01T00:00:00Z'
    delete process.env.SOURCE_EXPORT_GENERATOR_URL
    const { service, audit } = setup()
    await expect(
      service.plan(release, { organizationId: 'org-1', actor: 'admin@example.com' }),
    ).resolves.toMatchObject({
      status: 'license-verified',
      license: { id: 'license-1' },
      generator: {
        configured: false,
        deliverable: false,
        message: expect.stringContaining('不会产出源码'),
      },
      reasons: [],
    })
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'source_export.planned' }),
    )
  })

  it('许可与生成器都配置 → deliverable=true，但仍执行独立流水线', async () => {
    process.env.SOURCE_EXPORT_LICENSE_ID = 'license-1'
    process.env.SOURCE_EXPORT_GENERATOR_URL = 'https://generator.example.com'
    const { service } = setup()
    await expect(
      service.plan(release, { organizationId: 'org-1', actor: 'admin@example.com' }),
    ).resolves.toMatchObject({
      generator: { configured: true, deliverable: true },
    })
  })
})
