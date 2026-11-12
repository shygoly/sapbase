import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { AppCapabilitiesService } from './app-capabilities.service'

const CONSUMER = {
  id: 'consumer-1',
  organizationId: 'org-1',
  appKey: 'crm',
  blueprintId: 'crm',
  blueprintVersion: '1.0.0',
  status: 'active',
}

const PUBLISHER = {
  id: 'publisher-1',
  organizationId: 'org-1',
  appKey: 'erp',
  blueprintId: 'erp',
  blueprintVersion: '1.0.0',
  status: 'active',
}

function capability(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-1',
    organizationId: 'org-1',
    publisherAppKey: 'erp',
    name: 'customer.lookup',
    entity: 'Customer',
    fields: ['name', 'level'],
    permission: 'customer.read',
    ownerField: 'ownerId',
    readAllPermission: 'customer.read.all',
    status: 'active',
    version: 1,
    ...overrides,
  }
}

function setup() {
  const rows: any[] = []
  const capabilities = {
    findOne: jest.fn(async ({ where }: any) =>
      rows.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.publisherAppKey === where.publisherAppKey &&
          row.name === where.name,
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      rows.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (where.publisherAppKey === undefined ||
            row.publisherAppKey === where.publisherAppKey) &&
          (where.name === undefined || row.name === where.name),
      ),
    ),
    create: jest.fn((row: any) => ({ id: 'cap-1', ...row })),
    save: jest.fn(async (row: any) => {
      const index = rows.findIndex((item) => item.id === row.id)
      if (index >= 0) rows[index] = row
      else rows.push(row)
      return row
    }),
    manager: {
      query: jest.fn(async (_sql: string, _params?: unknown[]) => [
        {
          id: 'record-1',
          data: { name: 'Acme', level: 'A', secret: 'hidden' },
          state: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    },
  }
  const apps = {
    resolveActiveForOrganization: jest.fn(async () => CONSUMER),
    listForOrganization: jest.fn(async () => [PUBLISHER, CONSUMER]),
  }
  const audit = { create: jest.fn(async () => ({})) }
  const service = new AppCapabilitiesService(
    capabilities as never,
    apps as never,
    audit as never,
  )
  return { service, capabilities, apps, audit, rows }
}

describe('AppCapabilitiesService', () => {
  it('publish 校验能力名/字段并写审计', async () => {
    const { service, rows, audit } = setup()
    const published = await service.publish({
      organizationId: 'org-1',
      publisherAppKey: 'erp',
      name: 'customer.lookup',
      entity: 'Customer',
      fields: ['name', 'level', 'name'],
      permission: 'customer.read',
      ownerField: 'ownerId',
      readAllPermission: 'customer.read.all',
      actor: 'admin@example.com',
      actorId: 'u1',
    })
    expect(published).toMatchObject({
      publisherAppKey: 'erp',
      name: 'customer.lookup',
      fields: ['name', 'level'],
      version: 1,
    })
    expect(rows).toHaveLength(1)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'app_capability.published',
        metadata: expect.objectContaining({ name: 'customer.lookup' }),
      }),
    )

    await expect(
      service.publish({
        organizationId: 'org-1',
        publisherAppKey: 'erp',
        name: 'CustomerLookup',
        entity: 'Customer',
        fields: ['name'],
        permission: 'customer.read',
        actor: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.publish({
        organizationId: 'org-1',
        publisherAppKey: 'erp',
        name: 'customer.lookup',
        entity: 'Customer',
        fields: [],
        permission: 'customer.read',
        actor: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('invoke 只返回声明投影，并校验消费方/发布方/权限', async () => {
    const { service, rows, capabilities } = setup()
    rows.push(capability())
    const result = await service.invoke({
      organizationId: 'org-1',
      consumerInstallationId: 'consumer-1',
      publisherAppKey: 'erp',
      name: 'customer.lookup',
      userId: 'u1',
      permissions: ['customer.read'],
    })
    expect(result).toMatchObject({
      capability: {
        name: 'customer.lookup',
        publisherAppKey: 'erp',
        entity: 'Customer',
        fields: ['name', 'level'],
      },
      consumer: { appKey: 'crm', installationId: 'consumer-1' },
      publisher: { appKey: 'erp', installationId: 'publisher-1' },
    })
    expect(result.records[0]).toEqual({
      id: 'record-1',
      state: 'active',
      name: 'Acme',
      level: 'A',
    })
    expect(result.records[0]).not.toHaveProperty('secret')
    const sql = capabilities.manager.query.mock.calls[0][0] as string
    expect(sql).toContain('data->>$4 = $5')
    expect(capabilities.manager.query.mock.calls[0][1]).toEqual([
      'org-1',
      'erp',
      'Customer',
      'ownerId',
      'u1',
      50,
    ])
  })

  it('read-all 权限跳过 owner 过滤', async () => {
    const { service, rows, capabilities } = setup()
    rows.push(capability())
    await service.invoke({
      organizationId: 'org-1',
      consumerInstallationId: 'consumer-1',
      publisherAppKey: 'erp',
      name: 'customer.lookup',
      userId: 'u1',
      permissions: ['customer.read', 'customer.read.all'],
    })
    const sql = capabilities.manager.query.mock.calls[0][0] as string
    expect(sql).not.toContain('data->>')
  })

  it('缺权限/同应用/未知能力/发布方未安装 → 拒绝', async () => {
    const { service, rows, apps } = setup()
    rows.push(capability())
    await expect(
      service.invoke({
        organizationId: 'org-1',
        consumerInstallationId: 'consumer-1',
        publisherAppKey: 'erp',
        name: 'customer.lookup',
        userId: 'u1',
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    await expect(
      service.invoke({
        organizationId: 'org-1',
        consumerInstallationId: 'consumer-1',
        name: 'customer.lookup',
        userId: 'u1',
        permissions: ['customer.read'],
      }),
    ).resolves.toMatchObject({ capability: { publisherAppKey: 'erp' } })

    apps.listForOrganization.mockResolvedValueOnce([CONSUMER])
    await expect(
      service.invoke({
        organizationId: 'org-1',
        consumerInstallationId: 'consumer-1',
        publisherAppKey: 'erp',
        name: 'customer.lookup',
        userId: 'u1',
        permissions: ['customer.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    await expect(
      service.invoke({
        organizationId: 'org-1',
        consumerInstallationId: 'consumer-1',
        publisherAppKey: 'erp',
        name: 'missing.capability',
        userId: 'u1',
        permissions: ['customer.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('同名能力跨发布方且未指定 publisherAppKey → BadRequest', async () => {
    const { service, rows } = setup()
    rows.push(capability(), capability({ id: 'cap-2', publisherAppKey: 'other' }))
    await expect(
      service.invoke({
        organizationId: 'org-1',
        consumerInstallationId: 'consumer-1',
        name: 'customer.lookup',
        userId: 'u1',
        permissions: ['customer.read'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
