import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AppCatalogService } from './app-catalog.service'

const INSTALLATION = {
  id: 'app-1',
  organizationId: 'org-1',
  appKey: 'crm',
  displayName: 'CRM',
  slug: 'crm',
  blueprintId: 'crm',
  blueprintVersion: '1.0.0',
  releaseDigest: `sha256:${'a'.repeat(64)}`,
  runtimeRequirement: '>=1.0.0 <2.0.0',
  deploymentProfile: 'shared-saas',
  status: 'active',
  config: {},
  license: null,
  currentRevisionId: null,
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function setup() {
  const roleRows: any[] = []
  const brandRows: any[] = []
  const roles = {
    find: jest.fn(async ({ where }: any) =>
      roleRows.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          row.appKey === where.appKey &&
          (where.status === undefined || row.status === where.status),
      ),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      roleRows.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.appKey === where.appKey &&
          row.name === where.name,
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `role-${roleRows.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = roleRows.findIndex((item) => item.id === row.id)
      if (index >= 0) roleRows[index] = row
      else roleRows.push(row)
      return row
    }),
    remove: jest.fn(async (row: any) => {
      const index = roleRows.indexOf(row)
      if (index >= 0) roleRows.splice(index, 1)
      return row
    }),
  }
  const brands = {
    findOne: jest.fn(async ({ where }: any) =>
      brandRows.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.appKey === where.appKey,
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: 'brand-1', ...row })),
    save: jest.fn(async (row: any) => {
      const index = brandRows.findIndex((item) => item.id === row.id)
      if (index >= 0) brandRows[index] = row
      else brandRows.push(row)
      return row
    }),
  }
  const auditRows = [
    {
      id: 'audit-1',
      action: 'business_app.install',
      status: 'success',
      actor: 'admin@example.com',
      timestamp: new Date('2026-11-12T10:00:00Z'),
    },
  ]
  const auditLogs = {
    find: jest.fn(async () => auditRows),
    count: jest.fn(async () => 7),
  }
  const apps = {
    resolveActiveForOrganization: jest.fn(async () => INSTALLATION),
    navigationForInstallation: jest.fn(async () => ({
      source: 'blueprint-ui',
      navigation: [
        {
          identifier: 'crm-customers',
          label: '客户',
          path: '/dashboard/crm/customers',
          order: 1,
          permissions: ['crm.customer.read'],
        },
      ],
      routes: [
        {
          identifier: 'CustomerList',
          type: 'list',
          entity: 'Customer',
          route: '/dashboard/crm/customers',
          fields: ['name'],
        },
      ],
    })),
  }
  const entitlements = {
    findActive: jest.fn(async () => ({
      status: 'active',
      planName: 'pro',
      limits: { maxInstallations: 3 },
      validTo: null,
    })),
  }
  const usage = {
    summary: jest.fn(async () => [{ metric: 'maxMonthlyToolCalls', quantity: 5 }]),
  }
  const audit = { create: jest.fn(async () => ({})) }
  const service = new AppCatalogService(
    roles as never,
    brands as never,
    auditLogs as never,
    apps as never,
    entitlements as never,
    usage as never,
    audit as never,
  )
  return { service, roles, brands, auditLogs, apps, entitlements, usage, audit, roleRows, brandRows }
}

describe('AppCatalogService', () => {
  it('getCatalog 聚合应用角色/权限/菜单/品牌/审计/用量/权益', async () => {
    const { service, roleRows, brandRows } = setup()
    roleRows.push(
      {
        id: 'role-1',
        organizationId: 'org-1',
        appKey: 'crm',
        name: 'sales-manager',
        permissions: ['crm.customer.read', 'crm.opportunity.read'],
        source: 'manual',
        status: 'active',
      },
      {
        id: 'role-2',
        organizationId: 'org-1',
        appKey: 'crm',
        name: 'sales-rep',
        permissions: ['crm.customer.read'],
        source: 'manual',
        status: 'active',
      },
    )
    brandRows.push({
      id: 'brand-1',
      organizationId: 'org-1',
      appKey: 'crm',
      appName: 'Acme CRM',
      logoUrl: 'https://example.com/logo.png',
      faviconUrl: null,
      theme: { primary: '#000' },
      customCss: null,
      supportEmail: 'support@example.com',
      supportUrl: null,
    })
    const result = await service.getCatalog('app-1', 'org-1', [
      'crm.customer.read',
    ])
    expect(result.installation).toMatchObject({ id: 'app-1', appKey: 'crm' })
    expect(result.roles.map((role) => role.name)).toEqual([
      'sales-manager',
      'sales-rep',
    ])
    expect(result.permissions).toEqual([
      'crm.customer.read',
      'crm.opportunity.read',
    ])
    expect(result.menus).toHaveLength(1)
    expect(result.menus[0].path).toBe('/dashboard/crm/customers')
    expect(result.routes).toHaveLength(1)
    expect(result.branding).toMatchObject({ appName: 'Acme CRM' })
    expect(result.audit.total).toBe(7)
    expect(result.audit.recent[0]).toMatchObject({
      action: 'business_app.install',
      timestamp: '2026-11-12T10:00:00.000Z',
    })
    expect(result.usage).toEqual([{ metric: 'maxMonthlyToolCalls', quantity: 5 }])
    expect(result.entitlement).toMatchObject({ planName: 'pro', status: 'active' })
  })

  it('upsertRole 创建/更新并写审计；非法名称拒绝', async () => {
    const { service, roleRows, audit } = setup()
    const created = await service.upsertRole({
      organizationId: 'org-1',
      appKey: 'crm',
      name: 'sales-manager',
      permissions: ['crm.customer.read', 'crm.customer.read'],
      actor: 'admin@example.com',
      actorId: 'u1',
    })
    expect(created.permissions).toEqual(['crm.customer.read'])
    expect(roleRows).toHaveLength(1)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'app_role.changed',
        metadata: expect.objectContaining({ appKey: 'crm', name: 'sales-manager' }),
      }),
    )

    const updated = await service.upsertRole({
      organizationId: 'org-1',
      appKey: 'crm',
      name: 'sales-manager',
      permissions: ['crm.opportunity.read'],
      actor: 'admin@example.com',
      actorId: 'u1',
    })
    expect(updated.permissions).toEqual(['crm.opportunity.read'])
    expect(roleRows).toHaveLength(1)

    await expect(
      service.upsertRole({
        organizationId: 'org-1',
        appKey: 'crm',
        name: '1bad',
        permissions: [],
        actor: 'admin@example.com',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('deleteRole 删除并写审计；不存在 404', async () => {
    const { service, roleRows, audit } = setup()
    roleRows.push({
      id: 'role-1',
      organizationId: 'org-1',
      appKey: 'crm',
      name: 'sales-rep',
      permissions: [],
      source: 'manual',
      status: 'active',
    })
    await service.deleteRole({
      organizationId: 'org-1',
      appKey: 'crm',
      name: 'sales-rep',
      actor: 'admin@example.com',
    })
    expect(roleRows).toHaveLength(0)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'app_role.changed',
        metadata: expect.objectContaining({ change: 'delete' }),
      }),
    )
    await expect(
      service.deleteRole({
        organizationId: 'org-1',
        appKey: 'crm',
        name: 'missing',
        actor: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('updateBranding 创建/更新应用品牌并写审计', async () => {
    const { service, brandRows, audit } = setup()
    const created = await service.updateBranding({
      organizationId: 'org-1',
      appKey: 'crm',
      actor: 'admin@example.com',
      appName: 'Acme CRM',
      theme: { primary: '#000' },
    })
    expect(created).toMatchObject({ appKey: 'crm', appName: 'Acme CRM' })
    expect(brandRows).toHaveLength(1)

    const updated = await service.updateBranding({
      organizationId: 'org-1',
      appKey: 'crm',
      actor: 'admin@example.com',
      appName: 'Acme CRM 2',
    })
    expect(updated.appName).toBe('Acme CRM 2')
    expect(brandRows).toHaveLength(1)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'app_branding.changed',
        metadata: { appKey: 'crm' },
      }),
    )
  })
})
