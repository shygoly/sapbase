import { NotFoundException } from '@nestjs/common'
import { SemanticRuntimeService } from './semantic-runtime.service'
import type { SemanticEntity } from './record-validator'

const entity: SemanticEntity = {
  name: 'Student',
  fields: [
    { name: 'name', type: 'text' },
    { name: 'classId', type: 'text' },
    { name: 'headTeacherId', type: 'text' },
  ],
  states: [{ name: 'active', initial: true }],
  dataScope: {
    ownerField: 'headTeacherId',
    bindings: [{ dimension: 'class', kind: 'field', field: 'classId' }],
  },
}

function serviceWith(dataScope: unknown = { resolve: jest.fn() }) {
  const dataSource = { query: jest.fn(async () => []) }
  return new SemanticRuntimeService(
    {
      load: jest.fn(async () => ({
        manifest: { blueprint: 'pkg-1', version: '1' },
        compiled: {},
      })),
      packagesDirectory: () => '',
    } as never,
    {} as never,
    dataSource as never,
    {} as never,
    {} as never,
    dataScope as never,
  )
}

describe('SemanticRuntimeService dataScope integration helpers', () => {
  it('把蓝图 dataScope 映射成 ScopeBindingView 并交给 DataScopeService', async () => {
    const resolve = jest.fn(async () => ({ expr: { op: 'all' }, version: 1, declared: true }))
    const service = serviceWith({ resolve })

    const result = await (service as unknown as {
      resolveBlueprintDataScope: (
        blueprintId: string,
        entity: SemanticEntity,
        organizationId: string,
        actor: { id: string; role: string },
        action: string,
      ) => Promise<unknown>
    }).resolveBlueprintDataScope('pkg-1', entity, 'org-1', { id: 'u1', role: 'teacher' }, 'list')

    expect(result).toEqual({ expr: { op: 'all' }, version: 1, declared: true })
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        resourceKey: 'blueprint:pkg-1:Student',
        action: 'list',
        declared: true,
        actor: expect.objectContaining({ userId: 'u1', roleKeys: ['teacher'] }),
        bindings: [
          {
            resourceKey: 'blueprint:pkg-1:Student',
            dimensionKey: 'class',
            kind: 'field',
            field: 'classId',
            relation: null,
          },
        ],
      }),
    )
  })

  it('none → 单条读按 404 处理', async () => {
    const service = serviceWith({ resolve: jest.fn(async () => ({ expr: { op: 'none' }, version: 1, declared: true })) })
    await expect(
      (service as unknown as {
        assertRecordInDataScope: (
          blueprintId: string,
          entity: SemanticEntity,
          row: { id: string },
          organizationId: string,
          actor: { id: string },
          action: string,
        ) => Promise<void>
      }).assertRecordInDataScope('pkg-1', entity, { id: 'r1' }, 'org-1', { id: 'u1' }, 'read'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('all → 不额外查询', async () => {
    const query = jest.fn(async () => [])
    const dataSource = { query }
    const service = new SemanticRuntimeService(
      {
        load: jest.fn(async () => ({
          manifest: { blueprint: 'pkg-1', version: '1' },
          compiled: {},
        })),
        packagesDirectory: () => '',
      } as never,
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      { resolve: jest.fn(async () => ({ expr: { op: 'all' }, version: 1, declared: true })) } as never,
    )
    await (service as unknown as {
      assertRecordInDataScope: (
        blueprintId: string,
        entity: SemanticEntity,
        row: { id: string },
        organizationId: string,
        actor: { id: string },
        action: string,
      ) => Promise<void>
    }).assertRecordInDataScope('pkg-1', entity, { id: 'r1' }, 'org-1', { id: 'u1' }, 'read')
    expect(query).not.toHaveBeenCalled()
  })

  it('ownership 与 dataScope 组合为 AND', async () => {
    const queries: string[] = []
    const query = jest.fn(async (sql: string) => {
      queries.push(sql)
      if (sql.includes('SELECT COUNT')) return [{ total: 0 }]
      return []
    })
    const service = new SemanticRuntimeService(
      {
        load: jest.fn(async () => ({
          manifest: { blueprint: 'pkg-1', version: '1' },
          compiled: {},
        })),
        packagesDirectory: () => '',
      } as never,
      {} as never,
      { query } as never,
      {} as never,
      {} as never,
      { resolve: jest.fn() } as never,
    )
    jest
      .spyOn(
        service as unknown as {
          resolveBlueprintDataScope: (...args: unknown[]) => Promise<unknown>
        },
        'resolveBlueprintDataScope',
      )
      .mockResolvedValue({
        expr: {
          op: 'in',
          field: { kind: 'jsonb', column: 'data', path: 'classId' },
          values: [{ kind: 'literal', value: 'class-1' }],
        },
        version: 1,
        declared: true,
      })

    const composed = {
      ...entity,
      ownership: { field: 'ownerId', readAllPermission: 'student.readall' },
    }
    await (service as unknown as {
      listEnvelope: (
        blueprintId: string,
        entity: SemanticEntity,
        organizationId: string,
        query: Record<string, string | undefined>,
        actor: { id: string; permissions: string[] },
      ) => Promise<unknown>
    }).listEnvelope('pkg-1', composed, 'org-1', {}, { id: 'u1', permissions: [] })

    const sql = queries[0]
    expect(sql).toContain(`data->>'ownerId'`)
    expect(sql).toContain(`"blueprint_records"."data"->>'classId'`)
  })

  it('permissions policy → packageCap', () => {
    const service = serviceWith()
    const cap = (service as unknown as {
      permissionCapFor: (
        layer: unknown,
        entity: SemanticEntity,
        action: string,
        actor: { id: string; role: string },
      ) => unknown
    }).permissionCapFor(
      {
        rules: [
          {
            role: 'head_teacher',
            scope: 'policy',
            resources: ['Student'],
            actions: ['read'],
            dataScope: {
              dimension: 'class',
              depth: 'subtree',
              positions: ['head_teacher'],
            },
          },
        ],
      },
      entity,
      'read',
      { id: 'u1', role: 'head_teacher' },
    )
    expect(cap).toEqual({
      kind: 'node',
      dimension: 'class',
      anchor: 'membership',
      depth: 'subtree',
      positions: ['head_teacher'],
    })
  })

  it('create 越界 → 403', async () => {
    const dataSource = { query: jest.fn(async () => []) }
    const service = new SemanticRuntimeService(
      {
        load: jest.fn(async () => ({
          manifest: { blueprint: 'pkg-1', version: '1' },
          compiled: {},
        })),
        packagesDirectory: () => '',
      } as never,
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {
        resolve: jest.fn(async () => ({
          expr: {
            op: 'in',
            field: { kind: 'jsonb', column: 'data', path: 'classId' },
            values: [{ kind: 'literal', value: 'class-1' }],
          },
          version: 1,
          declared: true,
        })),
      } as never,
    )
    await expect(
      (service as unknown as {
        assertCreateInDataScope: (
          blueprintId: string,
          entity: SemanticEntity,
          data: Record<string, unknown>,
          organizationId: string,
          actor: { id: string },
        ) => Promise<void>
      }).assertCreateInDataScope('pkg-1', entity, { classId: 'class-2' }, 'org-1', { id: 'u1' }),
    ).rejects.toMatchObject({ status: 403, reason: 'data-scope-denied' })
  })
})
