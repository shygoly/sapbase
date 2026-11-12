import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { DataSource } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { SemanticRuntimeService } from '../semantic-runtime/semantic-runtime.service'
import { RecordOperation } from './record-operation.entity'
import { RecordSnapshot } from './record-snapshot.entity'

export interface LifecycleActor {
  id: string
  permissions: string[]
}

export interface RecordRow {
  id: string
  organizationId: string
  blueprintId: string
  blueprintVersion: string
  entity: string
  data: Record<string, unknown>
  state: string | null
  version: number
  archivedAt: Date | null
}

const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 记录生命周期：树 clone/move/reorder/archive/restore + 版本快照。
 *
 * 不改既有 CRUD/状态迁移；未声明 tree 的实体只支持单条 clone/snapshot/archive。
 * 所有操作在事务内完成并写 record_operations + audit_logs。
 */
@Injectable()
export class RecordLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly runtime: SemanticRuntimeService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async clone(input: {
    packageId: string
    entity: string
    recordId: string
    organizationId: string
    actor: LifecycleActor
    idempotencyKey?: string
    uniqueStrategy?: 'fail' | 'suffix' | 'placeholder'
    dataOverride?: Record<string, unknown>
  }) {
    const schema = await this.runtime.lifecycleSchema(
      input.packageId,
      input.organizationId,
      input.entity,
    )
    if (input.idempotencyKey) {
      const existing = await this.dataSource.getRepository(RecordOperation).findOne({
        where: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey },
      })
      if (existing?.status === 'succeeded') return existing.after
      if (existing?.status === 'failed') {
        throw new ConflictException(`幂等键已失败：${input.idempotencyKey}`)
      }
    }

    await this.assertWritable(input)
    const result = await this.dataSource.transaction(async (manager) => {
      const root = await this.loadRecord(
        manager,
        input.packageId,
        input.entity,
        input.recordId,
        input.organizationId,
      )
      const rows = await this.loadSubtree(manager, root, schema.tree)
      const max = Number(process.env.RECORD_CLONE_MAX_NODES ?? 5000)
      if (rows.length > max) {
        throw new BadRequestException(`克隆节点数 ${rows.length} 超过上限 ${max}`)
      }

      const idMap = new Map(rows.map((row) => [row.id, randomUUID()]))
      const strategy = input.uniqueStrategy ?? 'fail'
      const cloned: Array<{ id: string; sourceId: string }> = []

      for (const row of rows) {
        const data: Record<string, unknown> = { ...row.data, ...(row.id === root.id ? input.dataOverride ?? {} : {}) }
        if (schema.tree && data[schema.tree.parentField]) {
          const parent = String(data[schema.tree.parentField])
          if (idMap.has(parent)) data[schema.tree.parentField] = idMap.get(parent)
        }
        for (const field of schema.selfReferenceFields) {
          const value = data[field]
          if (typeof value === 'string' && idMap.has(value)) data[field] = idMap.get(value)
        }
        for (const field of schema.uniqueFields) {
          if (data[field] === undefined || data[field] === null) continue
          const conflict = await manager.query(
            `SELECT 1 FROM public.blueprint_records
              WHERE "organizationId" = $1 AND "blueprintId" = $2 AND entity = $3
                AND "archivedAt" IS NULL AND data->>$4 = $5 LIMIT 1`,
            [input.organizationId, root.blueprintId, input.entity, field, String(data[field])],
          )
          if (conflict.length === 0) continue
          if (strategy === 'fail') {
            throw new ConflictException(`唯一字段冲突：${field}=${String(data[field])}`)
          }
          data[field] =
            strategy === 'suffix'
              ? `${String(data[field])}-copy-${Date.now().toString(36)}`
              : null
        }
        const newId = idMap.get(row.id) as string
        await manager.query(
          `INSERT INTO public.blueprint_records
             (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
           VALUES ($1, now(), now(), $2, $3, $4, $5, $6::jsonb, $7, 1)`,
          [
            newId,
            input.organizationId,
            root.blueprintId,
            root.blueprintVersion,
            input.entity,
            JSON.stringify(data),
            row.state,
          ],
        )
        cloned.push({ id: newId, sourceId: row.id })
      }

      const after = {
        rootId: idMap.get(root.id),
        ids: cloned.map((item) => item.id),
        mapping: Object.fromEntries(idMap),
        cloned: cloned.length,
      }
      await this.recordOperation(manager, {
        organizationId: input.organizationId,
        blueprintId: root.blueprintId,
        entity: input.entity,
        recordId: idMap.get(root.id) ?? null,
        type: 'clone',
        idempotencyKey: input.idempotencyKey ?? null,
        before: { recordId: root.id },
        after,
        createdBy: input.actor.id,
      })
      return after
    })

    await this.audit(input, 'record.clone', {
      sourceId: input.recordId,
      targetId: result.rootId,
      cloned: result.cloned,
      uniqueStrategy: input.uniqueStrategy ?? 'fail',
    })
    return result
  }

  async move(input: {
    packageId: string
    entity: string
    recordId: string
    parentId: string | null
    organizationId: string
    actor: LifecycleActor
    order?: number
  }) {
    const schema = await this.runtime.lifecycleSchema(
      input.packageId,
      input.organizationId,
      input.entity,
    )
    await this.assertWritable(input)
    const tree = schema.tree
    if (!tree) throw new BadRequestException(`实体 ${input.entity} 未声明 tree`)
    const parentField = safeField(tree.parentField)

    await this.dataSource.transaction(async (manager) => {
      const row = await this.loadRecord(
        manager,
        input.packageId,
        input.entity,
        input.recordId,
        input.organizationId,
        true,
      )
      if (input.parentId) {
        if (input.parentId === input.recordId) throw new ConflictException('不能移动到自身下')
        const parent = await this.loadRecord(
          manager,
          input.packageId,
          input.entity,
          input.parentId,
          input.organizationId,
        )
        if (parent.archivedAt) throw new ConflictException('目标父节点已归档')
        await this.assertWritable({ ...input, recordId: input.parentId })
        const descendants = await this.descendantIds(manager, row, parentField)
        if (descendants.includes(input.parentId)) {
          throw new ConflictException('不能移动到自身后代下（会成环）')
        }
      }
      const data = {
        ...row.data,
        [tree.parentField]: input.parentId,
        ...(input.order !== undefined ? { [tree.orderField]: input.order } : {}),
      }
      const result = (await manager.query(
        `UPDATE public.blueprint_records
            SET data = $1::jsonb, version = version + 1, "updatedAt" = now()
          WHERE id = $2 AND "organizationId" = $3 AND version = $4
          RETURNING id`,
        [JSON.stringify(data), input.recordId, input.organizationId, row.version],
      )) as Array<{ id: string }>
      if (result.length === 0) {
        throw new ConflictException('记录已被并发修改，请重试')
      }
      await this.recordOperation(manager, {
        organizationId: input.organizationId,
        blueprintId: row.blueprintId,
        entity: input.entity,
        recordId: row.id,
        type: 'move',
        idempotencyKey: null,
        before: {
          parentId: row.data[tree.parentField] ?? null,
          order: row.data[tree.orderField] ?? null,
        },
        after: { parentId: input.parentId, order: input.order ?? row.data[tree.orderField] ?? null },
        createdBy: input.actor.id,
      })
    })
    await this.audit(input, 'record.move', {
      beforeParent: null,
      targetParent: input.parentId,
      order: input.order ?? null,
    })
    return this.getRecord(input.packageId, input.entity, input.recordId, input.organizationId)
  }

  async reorder(input: {
    packageId: string
    entity: string
    recordId: string
    order: number
    organizationId: string
    actor: LifecycleActor
  }) {
    const schema = await this.runtime.lifecycleSchema(
      input.packageId,
      input.organizationId,
      input.entity,
    )
    await this.assertWritable(input)
    if (!schema.tree) throw new BadRequestException(`实体 ${input.entity} 未声明 tree`)
    const row = await this.getRecord(
      input.packageId,
      input.entity,
      input.recordId,
      input.organizationId,
    )
    const data = { ...row.data, [schema.tree.orderField]: input.order }
    await this.dataSource.query(
      `UPDATE public.blueprint_records SET data = $1::jsonb, version = version + 1, "updatedAt" = now()
        WHERE id = $2 AND "organizationId" = $3`,
      [JSON.stringify(data), input.recordId, input.organizationId],
    )
    await this.audit(input, 'record.reorder', { order: input.order })
    return this.getRecord(input.packageId, input.entity, input.recordId, input.organizationId)
  }

  async archive(input: {
    packageId: string
    entity: string
    recordId: string
    organizationId: string
    actor: LifecycleActor
    reason?: string
    cascade?: boolean
  }) {
    const schema = await this.runtime.lifecycleSchema(
      input.packageId,
      input.organizationId,
      input.entity,
    )
    await this.assertWritable(input)
    const row = await this.getRecord(
      input.packageId,
      input.entity,
      input.recordId,
      input.organizationId,
    )
    const ids = input.cascade && schema.tree
      ? [row.id, ...(await this.descendantIds(
          this.dataSource.manager,
          row,
          safeField(schema.tree.parentField),
        ))]
      : [row.id]
    await this.dataSource.query(
      `UPDATE public.blueprint_records
          SET "archivedAt" = now(), "archivedBy" = $1, "archiveReason" = $2,
              version = version + 1, "updatedAt" = now()
        WHERE id = ANY($3::uuid[]) AND "organizationId" = $4`,
      [input.actor.id, input.reason ?? null, ids, input.organizationId],
    )
    await this.audit(input, 'record.archive', {
      reason: input.reason ?? null,
      cascade: Boolean(input.cascade),
      archived: ids.length,
    })
    return { archived: ids.length, ids }
  }

  async restore(input: {
    packageId: string
    entity: string
    recordId: string
    organizationId: string
    actor: LifecycleActor
  }) {
    const schema = await this.runtime.lifecycleSchema(
      input.packageId,
      input.organizationId,
      input.entity,
    )
    await this.assertWritable(input)
    const row = await this.getRecord(
      input.packageId,
      input.entity,
      input.recordId,
      input.organizationId,
    )
    if (!row.archivedAt) return { restored: true, alreadyActive: true }
    if (schema.tree && row.data[schema.tree.parentField]) {
      const parentId = String(row.data[schema.tree.parentField])
      const parents = (await this.dataSource.query(
        `SELECT "archivedAt" FROM public.blueprint_records WHERE id = $1 AND "organizationId" = $2`,
        [parentId, input.organizationId],
      )) as Array<{ archivedAt: Date | null }>
      if (!parents[0]) throw new ConflictException('父节点不存在')
      if (parents[0].archivedAt) throw new ConflictException('父节点已归档，先恢复父节点')
    }
    for (const field of schema.uniqueFields) {
      const value = row.data[field]
      if (value === null || value === undefined) continue
      const conflict = await this.dataSource.query(
        `SELECT 1 FROM public.blueprint_records
          WHERE "organizationId" = $1 AND "blueprintId" = $2 AND entity = $3
            AND id <> $4 AND "archivedAt" IS NULL AND data->>$5 = $6 LIMIT 1`,
        [
          input.organizationId,
          row.blueprintId,
          input.entity,
          row.id,
          field,
          String(value),
        ],
      )
      if (conflict.length > 0) throw new ConflictException(`恢复唯一键冲突：${field}`)
    }
    await this.dataSource.query(
      `UPDATE public.blueprint_records
          SET "archivedAt" = NULL, "archivedBy" = NULL, "archiveReason" = NULL,
              version = version + 1, "updatedAt" = now()
        WHERE id = $1 AND "organizationId" = $2`,
      [input.recordId, input.organizationId],
    )
    await this.audit(input, 'record.restore', {})
    return { restored: true }
  }

  async snapshot(input: {
    packageId: string
    entity: string
    recordId: string
    organizationId: string
    actor: LifecycleActor
    label?: string
    reason?: string
  }) {
    const row = await this.getRecord(
      input.packageId,
      input.entity,
      input.recordId,
      input.organizationId,
    )
    const version = await this.nextSnapshotVersion(input.recordId, input.organizationId)
    const repo = this.dataSource.getRepository(RecordSnapshot)
    const max = Number(process.env.RECORD_SNAPSHOT_MAX ?? 100)
    const current = await repo.count({
      where: { recordId: input.recordId, organizationId: input.organizationId },
    })
    if (current >= max) {
      const oldest = await repo.find({
        where: {
          recordId: input.recordId,
          organizationId: input.organizationId,
          published: false,
        },
        order: { version: 'ASC' },
        take: Math.max(1, current - max + 1),
      })
      if (oldest.length > 0) {
        await repo.delete(oldest.map((item) => item.id))
      } else {
        throw new ConflictException(`快照数量已达上限 ${max}（全部为已发布版本）`)
      }
    }
    const saved = await repo.save({
      organizationId: input.organizationId,
      blueprintId: row.blueprintId,
      entity: input.entity,
      recordId: input.recordId,
      version,
      label: input.label ?? null,
      data: row.data,
      state: row.state,
      createdBy: input.actor.id,
      reason: input.reason ?? null,
      published: false,
    })
    await this.audit(input, 'record.snapshot', { version, label: input.label ?? null })
    return saved
  }

  async publishSnapshot(input: {
    snapshotId: string
    label?: string
    organizationId: string
    actor: LifecycleActor
  }) {
    const repo = this.dataSource.getRepository(RecordSnapshot)
    const snapshot = await repo.findOne({
      where: { id: input.snapshotId, organizationId: input.organizationId },
    })
    if (!snapshot) throw new NotFoundException('快照不存在')
    snapshot.published = true
    snapshot.label = input.label ?? snapshot.label
    const saved = await repo.save(snapshot)
    await this.audit(
      { organizationId: input.organizationId, actor: input.actor },
      'record.snapshot.publish',
      { snapshotId: snapshot.id, version: snapshot.version },
    )
    return saved
  }

  async listSnapshots(input: {
    recordId: string
    organizationId: string
  }): Promise<RecordSnapshot[]> {
    return this.dataSource.getRepository(RecordSnapshot).find({
      where: { recordId: input.recordId, organizationId: input.organizationId },
      order: { version: 'DESC' },
    })
  }

  async diff(input: {
    recordId: string
    organizationId: string
    fromVersion: number
    toVersion: number
  }) {
    const repo = this.dataSource.getRepository(RecordSnapshot)
    const [from, to] = await Promise.all([
      repo.findOne({
        where: {
          recordId: input.recordId,
          organizationId: input.organizationId,
          version: input.fromVersion,
        },
      }),
      repo.findOne({
        where: {
          recordId: input.recordId,
          organizationId: input.organizationId,
          version: input.toVersion,
        },
      }),
    ])
    if (!from || !to) throw new NotFoundException('快照版本不存在')
    const fields = new Set([...Object.keys(from.data), ...Object.keys(to.data)])
    const changes: Array<{ field: string; from: unknown; to: unknown }> = []
    for (const field of fields) {
      if (JSON.stringify(from.data[field]) !== JSON.stringify(to.data[field])) {
        changes.push({ field, from: from.data[field] ?? null, to: to.data[field] ?? null })
      }
    }
    return {
      recordId: input.recordId,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      stateFrom: from.state,
      stateTo: to.state,
      changes,
    }
  }

  async restoreSnapshot(input: {
    snapshotId: string
    organizationId: string
    actor: LifecycleActor
  }) {
    const repo = this.dataSource.getRepository(RecordSnapshot)
    const snapshot = await repo.findOne({
      where: { id: input.snapshotId, organizationId: input.organizationId },
    })
    if (!snapshot) throw new NotFoundException('快照不存在')
    const record = await this.dataSource.query(
      `SELECT * FROM public.blueprint_records WHERE id = $1 AND "organizationId" = $2`,
      [snapshot.recordId, input.organizationId],
    )
    const current = record[0] as RecordRow | undefined
    if (!current) throw new NotFoundException('记录不存在')
    await this.dataSource.query(
      `UPDATE public.blueprint_records
          SET data = $1::jsonb, state = $2, version = version + 1, "updatedAt" = now()
        WHERE id = $3 AND "organizationId" = $4`,
      [JSON.stringify(snapshot.data), snapshot.state, snapshot.recordId, input.organizationId],
    )
    const version = await this.nextSnapshotVersion(snapshot.recordId, input.organizationId)
    const created = await repo.save({
      organizationId: input.organizationId,
      blueprintId: snapshot.blueprintId,
      entity: snapshot.entity,
      recordId: snapshot.recordId,
      version,
      label: `restore:v${snapshot.version}`,
      data: snapshot.data,
      state: snapshot.state,
      createdBy: input.actor.id,
      reason: `restore from v${snapshot.version}`,
      published: false,
    })
    await this.audit(input, 'record.snapshot.restore', {
      snapshotId: snapshot.id,
      fromVersion: snapshot.version,
      newVersion: version,
    })
    return { restoredFrom: snapshot.version, newVersion: version, snapshot: created }
  }

  private async assertWritable(input: {
    packageId: string
    entity: string
    recordId: string
    organizationId: string
    actor: LifecycleActor
  }): Promise<void> {
    const runtime = this.runtime as unknown as {
      assertWritable?: (
        packageId: string,
        entity: string,
        recordId: string,
        organizationId: string,
        actor: { id: string; permissions: string[] },
      ) => Promise<void>
    }
    await runtime.assertWritable?.(
      input.packageId,
      input.entity,
      input.recordId,
      input.organizationId,
      input.actor,
    )
  }

  private async getRecord(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
  ): Promise<RecordRow> {
    await this.runtime.lifecycleSchema(packageId, organizationId, entity)
    const rows = (await this.dataSource.query(
      `SELECT * FROM public.blueprint_records WHERE id = $1 AND "organizationId" = $2 AND entity = $3`,
      [recordId, organizationId, entity],
    )) as RecordRow[]
    if (!rows[0]) throw new NotFoundException('记录不存在')
    return rows[0]
  }

  private async loadRecord(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
    lock = false,
  ): Promise<RecordRow> {
    await this.runtime.lifecycleSchema(packageId, organizationId, entity)
    const rows = (await manager.query(
      `SELECT * FROM public.blueprint_records
        WHERE id = $1 AND "organizationId" = $2 AND entity = $3${lock ? ' FOR UPDATE' : ''}`,
      [recordId, organizationId, entity],
    )) as RecordRow[]
    if (!rows[0]) throw new NotFoundException('记录不存在')
    return rows[0]
  }

  private async loadSubtree(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    root: RecordRow,
    tree: { parentField: string; orderField: string } | null,
  ): Promise<RecordRow[]> {
    if (!tree) return [root]
    const parentField = safeField(tree.parentField)
    const rows = (await manager.query(
      `WITH RECURSIVE tree AS (
         SELECT r.*, 0 AS depth FROM public.blueprint_records r
          WHERE r.id = $1 AND r."organizationId" = $2 AND r.entity = $3 AND r."archivedAt" IS NULL
         UNION ALL
         SELECT c.*, t.depth + 1 FROM public.blueprint_records c
           JOIN tree t ON c.data->>$4 = t.id::text
          WHERE c."organizationId" = $2 AND c.entity = $3 AND c."archivedAt" IS NULL
       )
       SELECT * FROM tree ORDER BY depth ASC, id ASC`,
      [root.id, root.organizationId, root.entity, parentField],
    )) as RecordRow[]
    return rows
  }

  private async descendantIds(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    root: RecordRow,
    parentField: string,
  ): Promise<string[]> {
    const rows = (await manager.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM public.blueprint_records WHERE id = $1 AND "organizationId" = $2
         UNION ALL
         SELECT c.id FROM public.blueprint_records c
           JOIN tree t ON c.data->>$3 = t.id::text
          WHERE c."organizationId" = $2
       )
       SELECT id FROM tree WHERE id <> $1`,
      [root.id, root.organizationId, parentField],
    )) as Array<{ id: string }>
    return rows.map((row) => row.id)
  }

  private async nextSnapshotVersion(recordId: string, organizationId: string): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM public.record_snapshots
        WHERE "recordId" = $1 AND "organizationId" = $2`,
      [recordId, organizationId],
    )) as Array<{ next: number }>
    return Number(rows[0]?.next ?? 1)
  }

  private async recordOperation(
    manager: { getRepository: (entity: typeof RecordOperation) => any },
    input: Partial<RecordOperation>,
  ): Promise<void> {
    const repo = manager.getRepository(RecordOperation)
    await repo.save(repo.create(input))
  }

  private async audit(
    input: { organizationId: string; actor: LifecycleActor },
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs.create({
      organizationId: input.organizationId,
      action,
      resource: 'record',
      actor: input.actor.id,
      status: 'success',
      metadata,
      source: 'record-lifecycle',
    })
  }
}

function safeField(field: string): string {
  if (!SAFE_FIELD.test(field)) throw new BadRequestException(`非法字段名：${field}`)
  return field
}
