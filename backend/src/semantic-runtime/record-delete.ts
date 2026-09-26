import type { EntityManager } from 'typeorm'
import { collectRefs } from './document-writer'
import { validateRecord, type SemanticEntity } from './record-validator'
import { RecordWriteError } from './record-write-error'
import { BlueprintRecord } from './blueprint-record.entity'

export interface ReferrerHit {
  entity: string
  id: string
  field: string
  onDelete: 'restrict' | 'setNull'
}

const REFERRER_LIST_CAP = 20

export function referenceFieldsTo(
  entities: SemanticEntity[],
  targetEntity: string,
): Array<{ entity: string; field: string; onDelete: 'restrict' | 'setNull'; required?: boolean }> {
  const refs: Array<{
    entity: string
    field: string
    onDelete: 'restrict' | 'setNull'
    required?: boolean
  }> = []
  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.type === 'reference' && field.reference === targetEntity) {
        refs.push({
          entity: entity.name,
          field: field.name,
          onDelete: field.onDelete ?? 'restrict',
          required: field.required,
        })
      }
    }
  }
  return refs
}

export async function findReferrers(
  manager: EntityManager,
  input: {
    blueprintId: string
    organizationId: string
    targetEntity: string
    recordId: string
    entities: SemanticEntity[]
  },
): Promise<ReferrerHit[]> {
  const hits: ReferrerHit[] = []
  for (const ref of referenceFieldsTo(input.entities, input.targetEntity)) {
    const rows = (await manager.query(
      `SELECT id::text AS id, entity
         FROM public.blueprint_records
        WHERE "blueprintId" = $1
          AND "organizationId" = $2
          AND entity = $3
          AND data->>'${ref.field}' = $4`,
      [input.blueprintId, input.organizationId, ref.entity, input.recordId],
    )) as Array<{ id: string; entity: string }>
    for (const row of rows) {
      hits.push({
        entity: row.entity,
        id: row.id,
        field: ref.field,
        onDelete: ref.onDelete,
      })
    }
  }
  return hits
}

export function formatReferrerList(hits: ReferrerHit[]): string {
  const shown = hits.slice(0, REFERRER_LIST_CAP).map((hit) => `${hit.entity}:${hit.id}`)
  const extra = hits.length > REFERRER_LIST_CAP ? `（另有 ${hits.length - REFERRER_LIST_CAP} 条）` : ''
  return `${shown.join(', ')}${extra}`
}

/**
 * 按声明的 onDelete 处理引用后删除。restrict 列出引用方；setNull 置空并再校验。
 * cascade 本轮不做（编译期已拒）。
 */
export async function deleteRecordWithIntegrity(
  manager: EntityManager,
  input: {
    blueprintId: string
    organizationId: string
    entity: string
    recordId: string
    entities: SemanticEntity[]
    validation: Parameters<typeof validateRecord>[0]['validation']
  },
): Promise<void> {
  const hits = await findReferrers(manager, {
    blueprintId: input.blueprintId,
    organizationId: input.organizationId,
    targetEntity: input.entity,
    recordId: input.recordId,
    entities: input.entities,
  })

  const restricted = hits.filter((hit) => hit.onDelete === 'restrict')
  if (restricted.length > 0) {
    throw new RecordWriteError(
      `删除被拒：仍被引用。引用它的实例：${formatReferrerList(restricted)}`,
      'referenced',
    )
  }

  const repo = manager.getRepository(BlueprintRecord)
  for (const hit of hits.filter((item) => item.onDelete === 'setNull')) {
    const row = await repo.findOne({
      where: {
        id: hit.id,
        entity: hit.entity,
        blueprintId: input.blueprintId,
        organizationId: input.organizationId,
      },
    })
    if (!row) continue
    const nextData = { ...row.data }
    delete nextData[hit.field]
    const existingRefs = await collectRefs(
      manager,
      input.blueprintId,
      input.organizationId,
      input.entities,
      nextData,
    )
    const checked = validateRecord({
      entities: input.entities,
      validation: input.validation,
      entity: hit.entity,
      data: nextData,
      existingRefs,
    })
    if (!checked.ok) {
      throw new RecordWriteError(
        `setNull 后 ${hit.entity}:${hit.id} 不再满足校验：${checked.detail}`,
        checked.reason,
        checked.field,
        checked.ruleId,
      )
    }
    row.data = nextData
    await repo.save(row)
  }

  const result = await repo.delete({
    id: input.recordId,
    entity: input.entity,
    blueprintId: input.blueprintId,
    organizationId: input.organizationId,
  })
  if (!result.affected) {
    throw new RecordWriteError(`记录 ${input.entity}:${input.recordId} 不存在`, 'not-found')
  }
}
