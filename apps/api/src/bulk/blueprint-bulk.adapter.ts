import { BadRequestException, Injectable } from '@nestjs/common'
import { BlueprintService } from '../blueprint/blueprint.service'
import {
  SemanticRuntimeService,
  type BatchImportRow,
  type RuntimeActor,
} from '../semantic-runtime/semantic-runtime.service'
import type { SemanticEntity, SemanticField } from '../semantic-runtime/record-validator'
import type {
  AdapterContext,
  ExportAdapter,
  ExportPage,
  ExportQuery,
  ImportAdapter,
  ImportWriteOptions,
  ImportWriteResult,
  ResourceDescriptor,
  ResourceField,
} from './bulk.types'

const PREFIX = 'blueprint'
const SYSTEM_FIELDS: ResourceField[] = [
  { key: 'id', label: 'id', type: 'string', exportable: true, importable: false },
  { key: 'state', label: 'state', type: 'string', exportable: true, importable: false },
  { key: 'version', label: 'version', type: 'integer', exportable: true, importable: false },
  { key: 'createdAt', label: 'createdAt', type: 'datetime', exportable: true, importable: false },
  { key: 'updatedAt', label: 'updatedAt', type: 'datetime', exportable: true, importable: false },
]

function parseResourceKey(resourceKey: string): { packageId: string; entity: string } | null {
  if (!resourceKey.startsWith(`${PREFIX}:`)) return null
  const rest = resourceKey.slice(PREFIX.length + 1)
  const separator = rest.indexOf(':')
  if (separator <= 0 || separator === rest.length - 1) return null
  return { packageId: rest.slice(0, separator), entity: rest.slice(separator + 1) }
}

function mapType(field: SemanticField): ResourceField['type'] {
  switch (field.type) {
    case 'i32':
      return 'integer'
    case 'number':
      return 'number'
    case 'decimal':
      return 'decimal'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'enum':
      return 'enum'
    case 'reference':
      return 'reference'
    case 'json':
      return 'json'
    default:
      return 'string'
  }
}

function exampleFor(field: SemanticField): string {
  if (field.values && field.values.length > 0) return field.values[0]!
  switch (field.type) {
    case 'i32':
    case 'number':
      return '1'
    case 'decimal':
      return '1.00'
    case 'boolean':
      return 'true'
    case 'date':
      return '2026-01-01'
    case 'datetime':
      return '2026-01-01T00:00:00Z'
    case 'json':
      return '{}'
    default:
      return '示例'
  }
}

function toResourceDescriptor(
  packageId: string,
  entity: SemanticEntity,
): ResourceDescriptor {
  const fields: ResourceField[] = entity.fields.map((field) => ({
    key: field.name,
    label: field.name,
    type: mapType(field),
    required: field.required === true,
    enumValues: field.values,
    referenceResource:
      field.type === 'reference' && field.reference
        ? `${PREFIX}:${packageId}:${field.reference}`
        : undefined,
    permissions: field.permissions,
    exportable: true,
    importable: field.computed === undefined,
    example: exampleFor(field),
    description: field.type,
  }))
  return {
    resourceKey: `${PREFIX}:${packageId}:${entity.name}`,
    label: `${packageId}:${entity.name}`,
    description: 'Blueprint 实体（字段/引用/状态/字段权限由模板声明）',
    canImport: true,
    canExport: true,
    fields: [...fields, ...SYSTEM_FIELDS],
    importFormats: ['csv', 'json', 'xlsx'],
    exportFormats: ['csv', 'json', 'xlsx', 'md', 'pdf'],
  }
}

@Injectable()
export class BlueprintBulkAdapter implements ImportAdapter, ExportAdapter {
  readonly namespace = PREFIX

  constructor(
    private readonly blueprints: BlueprintService,
    private readonly runtime: SemanticRuntimeService,
  ) {}

  supports(resourceKey: string): boolean {
    return parseResourceKey(resourceKey) !== null
  }

  async describe(ctx: AdapterContext): Promise<ResourceDescriptor> {
    const parsed = parseResourceKey(ctx.resourceKey)
    if (!parsed) throw new BadRequestException(`非法 Blueprint 资源键：${ctx.resourceKey}`)
    const entities = await this.runtime.listEntities(parsed.packageId, ctx.organizationId)
    const entity = entities.find((item) => item.name === parsed.entity)
    if (!entity) {
      throw new BadRequestException(
        `蓝图 ${parsed.packageId} 未声明实体 ${parsed.entity}`,
      )
    }
    return toResourceDescriptor(parsed.packageId, entity)
  }

  async listResources(ctx: AdapterContext): Promise<ResourceDescriptor[]> {
    const resources: ResourceDescriptor[] = []
    for (const pkg of this.blueprints.list()) {
      try {
        const entities = await this.runtime.listEntities(pkg.id, ctx.organizationId)
        for (const entity of entities) {
          resources.push(toResourceDescriptor(pkg.id, entity))
        }
      } catch {
        // 未授权/损坏的包不阻断资源列表；真正请求时由 describe 返回明确原因。
      }
    }
    return resources
  }

  async write(
    ctx: AdapterContext,
    rows: BatchImportRow[],
    options: ImportWriteOptions,
  ): Promise<ImportWriteResult> {
    const parsed = parseResourceKey(ctx.resourceKey)
    if (!parsed) throw new BadRequestException(`非法 Blueprint 资源键：${ctx.resourceKey}`)
    const actor: RuntimeActor = {
      id: ctx.actor.id,
      role: ctx.actor.role ?? null,
      permissions: ctx.actor.permissions,
    }
    const result = await this.runtime.importBatch(
      parsed.packageId,
      parsed.entity,
      rows.map((row) => ({ row: row.row, data: row.data })),
      {
        mode: options.mode,
        dryRun: options.dryRun,
        isCancelled: options.isCancelled,
        onProgress: options.onProgress,
      },
      ctx.organizationId,
      actor,
    )
    return {
      imported: result.imported,
      validated: result.validated,
      errors: result.errors.map((error) => ({
        row: error.row,
        field: error.field,
        reason: error.reason,
        message: error.message,
      })),
    }
  }

  async exportPage(ctx: AdapterContext, query: ExportQuery): Promise<ExportPage> {
    const parsed = parseResourceKey(ctx.resourceKey)
    if (!parsed) throw new BadRequestException(`非法 Blueprint 资源键：${ctx.resourceKey}`)
    const actor: RuntimeActor = {
      id: ctx.actor.id,
      role: ctx.actor.role ?? null,
      permissions: ctx.actor.permissions,
    }
    const state =
      query.filter && typeof query.filter.state === 'string'
        ? String(query.filter.state)
        : undefined
    const filter = { ...(query.filter ?? {}) }
    delete filter.state
    const result = await this.runtime.list(
      parsed.packageId,
      parsed.entity,
      ctx.organizationId,
      {
        page: String(query.page),
        pageSize: String(Math.min(query.pageSize, 100)),
        ...(query.sort ? { sort: query.sort } : {}),
        ...(query.order ? { order: query.order } : {}),
        ...(state ? { state } : {}),
        ...(Object.keys(filter).length > 0 ? { filter: JSON.stringify(filter) } : {}),
      },
      actor,
    )
    const envelope = result as unknown as {
      items: Array<{
        data: Record<string, unknown>
        id: string
        state?: string | null
        version: number
        createdAt: Date
        updatedAt: Date
      }>
      total: number
    }
    return {
      total: envelope.total,
      rows: envelope.items.map((row) => ({
        ...row.data,
        id: row.id,
        state: row.state ?? null,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    }
  }
}
