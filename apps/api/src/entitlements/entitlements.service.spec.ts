import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { EntitlementsService } from '@sap/platform-core/entitlements/entitlements.service'
import { findPlan, normalizePlanName, planIncludesApp } from '@sap/platform-core/entitlements/plan-catalog'

function setup(options: {
  organization?: { id: string; planName?: string | null } | null
  existing?: any[]
  usage?: number
} = {}) {
  const rows = [...(options.existing ?? [])]
  const repository = {
    find: jest.fn(async ({ where }: any) =>
      rows.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (where.appKey === undefined || row.appKey === where.appKey),
      ),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      rows.find(
        (row) =>
          row.organizationId === where.organizationId &&
          (where.appKey === undefined || row.appKey === where.appKey),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `ent-${row.appKey}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = rows.findIndex((item) => item.id === row.id)
      if (index >= 0) rows[index] = row
      else rows.push(row)
      return row
    }),
    count: jest.fn(async ({ where }: any) =>
      rows.filter((row) => row.organizationId === where.organizationId).length,
    ),
    update: jest.fn(async () => ({ affected: 0 })),
  }
  const organizations = {
    findOne: jest.fn(async () => options.organization ?? null),
  }
  const usage = {
    currentUsage: jest.fn(async () => options.usage ?? 0),
  }
  const service = new EntitlementsService(
    repository as never,
    organizations as never,
    usage as never,
  )
  return { service, repository, organizations, usage, rows }
}

describe('plan catalog', () => {
  it('计划名归一与未知计划 fail-closed', () => {
    expect(normalizePlanName(' Pro ')).toBe('pro')
    expect(normalizePlanName('free')).toBe('starter')
    expect(normalizePlanName('unknown')).toBeNull()
    expect(findPlan('unknown')).toBeNull()
    expect(findPlan('Enterprise')).toMatchObject({ key: 'enterprise', apps: '*' })
  })

  it('计划包含应用：显式列表与通配', () => {
    const starter = findPlan('starter')!
    const enterprise = findPlan('enterprise')!
    expect(planIncludesApp(starter, 'erp')).toBe(true)
    expect(planIncludesApp(starter, 'crm')).toBe(false)
    expect(planIncludesApp(enterprise, 'anything')).toBe(true)
  })
})

describe('EntitlementsService', () => {
  it('syncPlan 物化计划应用，重复调用幂等', async () => {
    const { service, rows } = setup({
      organization: { id: 'org-1', planName: 'pro' },
    })
    const first = await service.syncPlan('org-1', undefined, 'admin-1')
    expect(first.created.sort()).toEqual(['auto-parts', 'crm', 'education', 'erp'])
    expect(first.updated).toEqual([])
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ source: 'plan', status: 'active' })

    const second = await service.syncPlan('org-1', 'pro')
    expect(second.created).toEqual([])
    expect(second.updated.sort()).toEqual(['auto-parts', 'crm', 'education', 'erp'])
    expect(rows).toHaveLength(4)
  })

  it('降级计划：挂起不再包含的计划权益，保留手工权益', async () => {
    const { service, rows } = setup({
      organization: { id: 'org-1', planName: 'starter' },
      existing: [
        {
          id: 'ent-erp',
          organizationId: 'org-1',
          appKey: 'erp',
          planName: 'pro',
          source: 'plan',
          status: 'active',
          limits: {},
          validFrom: new Date(),
          validTo: null,
        },
        {
          id: 'ent-crm',
          organizationId: 'org-1',
          appKey: 'crm',
          planName: 'pro',
          source: 'plan',
          status: 'active',
          limits: {},
          validFrom: new Date(),
          validTo: null,
        },
        {
          id: 'ent-manual',
          organizationId: 'org-1',
          appKey: 'manual-app',
          planName: 'custom',
          source: 'manual',
          status: 'active',
          limits: { maxInstallations: 9 },
          validFrom: new Date(),
          validTo: null,
        },
      ],
    })
    const result = await service.syncPlan('org-1')
    expect(result.suspended).toEqual(['crm'])
    expect(rows.find((row) => row.appKey === 'crm')!.status).toBe('suspended')
    expect(rows.find((row) => row.appKey === 'manual-app')!.status).toBe('active')
  })

  it('未知计划 → BadRequest；组织不存在 → NotFound', async () => {
    const { service } = setup({
      organization: { id: 'org-1', planName: 'mystery' },
    })
    await expect(service.syncPlan('org-1')).rejects.toThrow(/未知计划/)
    const missing = setup({ organization: null })
    await expect(missing.service.syncPlan('org-1', 'pro')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('findActive 只返回 active 且在有效期内的权益', async () => {
    const now = new Date()
    const { service } = setup({
      existing: [
        {
          id: 'ent-1',
          organizationId: 'org-1',
          appKey: 'erp',
          source: 'plan',
          status: 'active',
          limits: {},
          validFrom: new Date(now.getTime() - 1000),
          validTo: new Date(now.getTime() + 1000),
        },
        {
          id: 'ent-2',
          organizationId: 'org-1',
          appKey: 'crm',
          source: 'plan',
          status: 'suspended',
          limits: {},
          validFrom: null,
          validTo: null,
        },
        {
          id: 'ent-3',
          organizationId: 'org-1',
          appKey: 'education',
          source: 'plan',
          status: 'active',
          limits: {},
          validFrom: null,
          validTo: new Date(now.getTime() - 1000),
        },
      ],
    })
    await expect(service.findActive('org-1', 'erp')).resolves.toMatchObject({ id: 'ent-1' })
    await expect(service.findActive('org-1', 'crm')).resolves.toBeNull()
    await expect(service.findActive('org-1', 'education')).resolves.toBeNull()
    await expect(service.assertEntitled('org-1', 'crm')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('配额检查：未超限通过，超限拒绝；无权益保持兼容放行', async () => {
    const entitlement = {
      id: 'ent-1',
      organizationId: 'org-1',
      appKey: 'erp',
      source: 'plan',
      status: 'active',
      limits: { maxMonthlyToolCalls: 10, maxInstallations: 2 },
      validFrom: null,
      validTo: null,
    }
    const { service } = setup({ existing: [entitlement], usage: 9 })
    await expect(
      service.assertWithinQuota({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        amount: 1,
        entitlement: entitlement as never,
      }),
    ).resolves.toMatchObject({ allowed: true, limit: 10, used: 9 })

    await expect(
      service.checkWithinQuota({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        amount: 2,
        entitlement: entitlement as never,
      }),
    ).resolves.toMatchObject({ allowed: false, limit: 10, used: 9 })

    await expect(
      service.assertWithinQuota({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        amount: 2,
        entitlement: entitlement as never,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    await expect(
      service.checkWithinQuota({
        organizationId: 'org-1',
        appKey: 'missing',
        metric: 'maxMonthlyToolCalls',
      }),
    ).resolves.toMatchObject({ allowed: true, limit: null })
  })

  it('安装配额使用调用方统计值，不读月度用量', async () => {
    const entitlement = {
      id: 'ent-1',
      organizationId: 'org-1',
      appKey: 'erp',
      source: 'plan',
      status: 'active',
      limits: { maxInstallations: 2 },
      validFrom: null,
      validTo: null,
    }
    const { service, usage } = setup({ existing: [entitlement] })
    await expect(
      service.checkWithinQuota({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxInstallations',
        amount: 1,
        used: 2,
        entitlement: entitlement as never,
      }),
    ).resolves.toMatchObject({ allowed: false, used: 2 })
    expect(usage.currentUsage).not.toHaveBeenCalled()
  })
})
