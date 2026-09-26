import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { join } from 'node:path'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { evaluateCondition } from '../blueprint/expression-evaluator'
import { BlueprintService } from '../blueprint/blueprint.service'
import { CompileError } from '../blueprint/compiler'
import { LoadError } from '../blueprint/loader'
import { PackageError, unpackBlueprint } from '../blueprint/packager'
import { formatFixed } from '../blueprint/money'
import { AccountingError, assertBalanced, generateEntries, type AccountingRuleDecl } from './accounting'
import {
  applyApprove,
  buildPendingSteps,
  isFullyApproved,
  toChainView,
  type ApprovalChainView,
  type ApprovalRuleDecl,
  type ApprovalStepState,
} from './approval'
import { BlueprintApproval } from './blueprint-approval.entity'
import { BlueprintJournalEntry } from './blueprint-journal-entry.entity'
import { BlueprintRecord } from './blueprint-record.entity'
import { applyNotNullConstraints, constraintFieldMap } from './db-constraints'
import {
  initialStateOf,
  resolveState,
  writeDocumentOrRecord,
  type DocumentEntity,
} from './document-writer'
import { buildEvalContext } from './eval-context'
import { assertRecordStateDeclared, assertTransitionLegal } from './record-transition'
import { deleteRecordWithIntegrity } from './record-delete'
import {
  filterSql,
  hasQueryParams,
  parseRecordQuery,
  sortSqlExpression,
  type QueryEnvelope,
} from './record-query'
import { materializeDefaults, type SemanticEntity, type ValidationRule } from './record-validator'
import { mapConstraintError, RecordWriteError } from './record-write-error'
import { applyUniqueIndexes } from './unique-index'
import {
  assembleFitmentCandidates,
  fitmentRowFromData,
  parseFitmentQuery,
} from './fitment-query'
import { isDryRun, normalizeImportInput, type ImportBody } from './import-rows'
import { assembleTraceability, type RelatedRecord } from './traceability'
import {
  actorId,
  actorPermissions,
  canReadAllOwned,
  declaredMoneyCurrency,
  filterOwnedRows,
  forbiddenWriteFields,
  omitRestrictedFields,
  STAMPED_CURRENCY_KEY,
  type RuntimeActor,
} from './field-permissions'
import {
  assembleInTransitView,
  assembleReceivableView,
  assembleStockView,
  type InTransitAggRow,
  type ReceivableAggRow,
  type StockAggRow,
} from './views'

export type { RuntimeActor } from './field-permissions'

const IMPORTABLE_ENTITIES = new Set(['Part', 'Customer', 'Supplier'])
const DRY_RUN_ROLLBACK = Symbol('import-dry-run')

export { RecordWriteError, toHttpException } from './record-write-error'

interface SemanticFile {
  entities: DocumentEntity[]
}

interface RulesFile {
  validation: ValidationRule[]
  approval?: ApprovalRuleDecl[]
  accounting?: AccountingRuleDecl[]
}

interface LoadedTemplate {
  entities: DocumentEntity[]
  validation: ValidationRule[]
  approval: ApprovalRuleDecl[]
  accounting: AccountingRuleDecl[]
}

export interface TransitionResult extends BlueprintRecord {
  journalEntries: Array<{
    ruleId: string
    event: string
    account: string
    side: 'debit' | 'credit'
    amount: string
    scale: number
  }>
}

/**
 * 写入链（顺序固定，任一不过即拒、不落库）：
 *   1. 装载模板（复用 loadBlueprint，授权门自动生效）
 *   2. 幂等应用唯一索引（P1；有冲突报清单不硬建）
 *   3. 事务内 validateRecord + 落库（头+行走 document-writer）
 */
@Injectable()
export class SemanticRuntimeService {
  constructor(
    private readonly blueprints: BlueprintService,
    @InjectRepository(BlueprintRecord)
    private readonly records: Repository<BlueprintRecord>,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async write(
    packageId: string,
    entity: string,
    data: Record<string, unknown>,
    organizationId: string,
    actor?: RuntimeActor,
  ): Promise<BlueprintRecord> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝写入', 'missing-tenant')
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new RecordWriteError('记录体必须是对象', 'type-mismatch')
    }

    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    this.assertWritablePayload(template.entities, entity, data, actor)
    await this.applyIndexesOrThrow(
      loaded.manifest.blueprint,
      loaded.manifest.version,
      template.entities,
    )
    const constraintMap = constraintFieldMap(loaded.manifest.blueprint, {
      entities: template.entities,
    })

    try {
      return await this.dataSource.transaction(async (manager) => {
        const row = await writeDocumentOrRecord(
          {
            manager,
            blueprintId: loaded.manifest.blueprint,
            blueprintVersion: loaded.manifest.version,
            organizationId,
            entities: template.entities,
            validation: template.validation,
            constraintMap,
          },
          entity,
          data,
        )
        await this.ensureApprovalChains(
          manager,
          loaded.manifest.blueprint,
          loaded.manifest.version,
          organizationId,
          entity,
          row.id,
          row.data,
          template,
        )
        const declared = template.entities.find((item) => item.name === entity)
        return declared ? this.withResolvedState(row, declared, actor) : row
      })
    } catch (error) {
      throw mapConstraintError(error, constraintMap) ?? error
    }
  }

  /** 批次反向查询：batchNo → 单据/客户。未知批次 found:false，不 404。 */
  async traceBatch(
    packageId: string,
    code: string,
    organizationId: string,
    actor?: RuntimeActor,
  ) {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝追溯', 'missing-tenant')
    }
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new RecordWriteError('批次号不能为空', 'type-mismatch', 'code')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    if (!template.entities.some((item) => item.name === 'Batch')) {
      throw new RecordWriteError('模板未声明实体 Batch', 'unknown-entity')
    }

    const batchNo = code.trim()
    const batches = (await this.dataSource.query(
      `SELECT id, data FROM public.blueprint_records
        WHERE "blueprintId" = $1 AND "organizationId" = $2
          AND entity = 'Batch' AND data->>'batchNo' = $3
        ORDER BY id ASC`,
      [loaded.manifest.blueprint, organizationId, batchNo],
    )) as RelatedRecord[]

    const partIds = batches.map((row) => row.data.part).filter((id): id is string => typeof id === 'string')
    const orderIds = batches.map((row) => row.data.order).filter((id): id is string => typeof id === 'string')
      const [parts, orders] = await Promise.all([
      this.listByIds(
        loaded.manifest.blueprint,
        organizationId,
        'Part',
        partIds,
        template.entities.find((item) => item.name === 'Part'),
        actor,
      ),
      this.listByIds(
        loaded.manifest.blueprint,
        organizationId,
        'SalesOrder',
        orderIds,
        template.entities.find((item) => item.name === 'SalesOrder'),
        actor,
      ),
    ])
    const customerIds = [...orders.values()]
      .map((order) => order.data.customer)
      .filter((id): id is string => typeof id === 'string')
    const customers = await this.listByIds(
      loaded.manifest.blueprint,
      organizationId,
      'Customer',
      customerIds,
      template.entities.find((item) => item.name === 'Customer'),
      actor,
    )

    const result = assembleTraceability(batchNo, batches, { parts, orders, customers })
    await this.auditLogs.create({
      action: 'blueprint.traceability.batch',
      resource: 'Batch',
      actor: 'semantic-runtime',
      status: 'success',
      organizationId,
      metadata: {
        blueprintId: loaded.manifest.blueprint,
        found: result.found,
        hits: result.hits.length,
      },
    })
    return result
  }

  /** 车辆适配宿主查询（不做原子）：车型/年款/位置 → 去重零件候选 + 命中依据。 */
  async queryFitment(
    packageId: string,
    query: Record<string, string | undefined>,
    organizationId: string,
  ) {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝适配查询', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const fitment = template.entities.find((item) => item.name === 'Fitment')
    if (!fitment) {
      throw new RecordWriteError('模板未声明实体 Fitment', 'unknown-entity')
    }
    const positionField = fitment.fields.find((field) => field.name === 'position')
    const parsed = parseFitmentQuery(query, positionField?.values ?? [])

    const params: unknown[] = [
      loaded.manifest.blueprint,
      organizationId,
      parsed.make,
      parsed.model,
      parsed.year,
    ]
    let sql = `SELECT id, data FROM public.blueprint_records
      WHERE "blueprintId" = $1 AND "organizationId" = $2 AND entity = 'Fitment'
        AND lower(data->>'make') = lower($3)
        AND lower(data->>'model') = lower($4)
        AND (data->>'yearFrom')::int <= $5
        AND (data->>'yearTo')::int >= $5`
    if (parsed.position !== undefined) {
      sql += ` AND data->>'position' = $6`
      params.push(parsed.position)
    }
    sql += ' ORDER BY id ASC'

    const rows = (await this.dataSource.query(sql, params)) as RelatedRecord[]
    const fitmentRows = rows
      .map((row) => fitmentRowFromData(row.id, row.data))
      .filter((row): row is NonNullable<typeof row> => row !== null)
    const partIds = [...new Set(fitmentRows.map((row) => row.part))]
    const partMap = await this.listByIds(loaded.manifest.blueprint, organizationId, 'Part', partIds)
    const parts = new Map(
      [...partMap.entries()].map(([id, record]) => [
        id,
        {
          partNo: typeof record.data.partNo === 'string' ? record.data.partNo : undefined,
          name: typeof record.data.name === 'string' ? record.data.name : undefined,
        },
      ]),
    )
    const candidates = assembleFitmentCandidates(fitmentRows, parsed, parts)
    await this.auditLogs.create({
      action: 'blueprint.fitment.query',
      resource: 'Fitment',
      actor: 'semantic-runtime',
      status: 'success',
      organizationId,
      metadata: {
        blueprintId: loaded.manifest.blueprint,
        make: parsed.make,
        model: parsed.model,
        year: parsed.year,
        position: parsed.position,
        parts: candidates.length,
      },
    })
    return {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      position: parsed.position ?? null,
      parts: candidates,
    }
  }

  /** 主数据导入：模板只加载一次；每行独立事务；部分成功是有意例外。 */
  async importMaster(
    packageId: string,
    entity: string,
    body: ImportBody,
    organizationId: string,
    actor?: RuntimeActor,
  ) {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝导入', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    if (declared.children && declared.children.length > 0) {
      throw new RecordWriteError(
        `实体 ${entity} 声明了 children，头行事务不能从 CSV/JSON 导入`,
        'import-document-unsupported',
      )
    }
    if (!IMPORTABLE_ENTITIES.has(entity)) {
      throw new RecordWriteError(
        `本轮主数据导入只支持 Part / Customer / Supplier，拒绝 ${entity}`,
        'import-entity-unsupported',
      )
    }

    await this.applyIndexesOrThrow(
      loaded.manifest.blueprint,
      loaded.manifest.version,
      template.entities,
    )
    const constraintMap = constraintFieldMap(loaded.manifest.blueprint, {
      entities: template.entities,
    })
    const normalized = normalizeImportInput(body, declared)
    const dryRun = isDryRun(body)
    const granted = actorPermissions(actor)
    for (const row of normalized.rows) {
      const forbidden = forbiddenWriteFields(declared, row.data, granted)
      if (forbidden.length > 0) {
        throw new RecordWriteError(
          `无权写入字段 ${entity}.${forbidden[0]}`,
          'forbidden-field',
          forbidden[0],
          undefined,
          403,
        )
      }
    }
    let imported = 0
    let failed = 0
    let validated = 0
    const errors: Array<{
      line: number
      reason: string
      field?: string
      ruleId?: string
      message: string
    }> = []

    for (const row of normalized.rows) {
      try {
        await this.dataSource.transaction(async (manager) => {
          await writeDocumentOrRecord(
            {
              manager,
              blueprintId: loaded.manifest.blueprint,
              blueprintVersion: loaded.manifest.version,
              organizationId,
              entities: template.entities,
              validation: template.validation,
              constraintMap,
            },
            entity,
            row.data,
          )
          if (dryRun) throw DRY_RUN_ROLLBACK
        })
        imported += 1
      } catch (error) {
        if (error === DRY_RUN_ROLLBACK) {
          validated += 1
          continue
        }
        const mapped = mapConstraintError(error, constraintMap) ?? error
        if (mapped instanceof RecordWriteError) {
          errors.push({
            line: row.line,
            reason: mapped.reason,
            field: mapped.field,
            ruleId: mapped.ruleId,
            message: mapped.message,
          })
          failed += 1
          continue
        }
        throw mapped
      }
    }

    await this.auditLogs.create({
      action: 'blueprint.import',
      resource: entity,
      actor: 'semantic-runtime',
      status: failed > 0 && imported === 0 && validated === 0 ? 'failure' : 'success',
      organizationId,
      metadata: {
        blueprintId: loaded.manifest.blueprint,
        source: normalized.source,
        imported,
        failed,
        validated: dryRun ? validated : undefined,
        dryRun,
      },
    })

    return {
      entity,
      source: normalized.source,
      imported,
      failed,
      validated: dryRun ? validated : undefined,
      errors,
      dryRun,
    }
  }

  private async listByIds(
    blueprintId: string,
    organizationId: string,
    entity: string,
    ids: string[],
    declared?: SemanticEntity,
    actor?: RuntimeActor,
  ): Promise<Map<string, RelatedRecord>> {
    const found = new Map<string, RelatedRecord>()
    if (ids.length === 0) return found
    const rows = (await this.dataSource.query(
      `SELECT id, data FROM public.blueprint_records
        WHERE "blueprintId" = $1 AND "organizationId" = $2 AND entity = $3 AND id = ANY($4::uuid[])`,
      [blueprintId, organizationId, entity, ids],
    )) as Array<{ id: string; data: Record<string, unknown> }>
    for (const row of rows) {
      const data = declared
        ? this.withResolvedState({ data: row.data } as BlueprintRecord, declared, actor).data
        : row.data
      found.set(row.id, { id: row.id, data })
    }
    return found
  }

  async list(
    packageId: string,
    entity: string,
    organizationId: string,
    query?: Record<string, string | undefined>,
    actor?: RuntimeActor,
  ): Promise<BlueprintRecord[] | QueryEnvelope<BlueprintRecord>> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }

    if (!hasQueryParams(query)) {
      const rows = await this.records.find({
        where: {
          blueprintId: loaded.manifest.blueprint,
          entity,
          organizationId,
        },
        order: { createdAt: 'ASC' },
      })
      return filterOwnedRows(declared, rows, actor).map((row) =>
        this.withResolvedState(row, declared, actor),
      )
    }

    return this.listEnvelope(loaded.manifest.blueprint, declared, organizationId, query ?? {}, actor)
  }

  async viewStock(packageId: string, organizationId: string) {
    return this.runBuiltinView(packageId, organizationId, 'stock', async (blueprintId) => {
      const rows = (await this.dataSource.query(
        `SELECT s.data->>'part' AS "partId",
                p.data->>'partNo' AS "partNo",
                COALESCE(SUM(COALESCE((s.data->>'quantity')::integer, 0)), 0) AS "onHand",
                COALESCE(SUM(COALESCE((s.data->>'reserved')::integer, 0)), 0) AS "reserved",
                COALESCE(SUM(COALESCE((s.data->>'quantity')::integer, 0)
                           - COALESCE((s.data->>'reserved')::integer, 0)), 0) AS "available",
                COALESCE(SUM(COALESCE((s.data->>'inTransit')::integer, 0)), 0) AS "inTransit"
           FROM public.blueprint_records s
           LEFT JOIN public.blueprint_records p
             ON p.entity = 'Part'
            AND p."blueprintId" = $1
            AND p."organizationId" = $2
            AND p.id::text = s.data->>'part'
          WHERE s."blueprintId" = $1
            AND s."organizationId" = $2
            AND s.entity = 'StockItem'
          GROUP BY s.data->>'part', p.data->>'partNo'
          ORDER BY p.data->>'partNo' NULLS LAST, s.data->>'part'`,
        [blueprintId, organizationId],
      )) as StockAggRow[]
      return assembleStockView(rows)
    })
  }

  async viewInTransit(packageId: string, organizationId: string) {
    return this.runBuiltinView(packageId, organizationId, 'in-transit', async (blueprintId) => {
      const rows = (await this.dataSource.query(
        `SELECT s.data->>'part' AS "partId",
                p.data->>'partNo' AS "partNo",
                COALESCE(SUM(COALESCE((s.data->>'inTransit')::integer, 0)), 0) AS "inTransit"
           FROM public.blueprint_records s
           LEFT JOIN public.blueprint_records p
             ON p.entity = 'Part'
            AND p."blueprintId" = $1
            AND p."organizationId" = $2
            AND p.id::text = s.data->>'part'
          WHERE s."blueprintId" = $1
            AND s."organizationId" = $2
            AND s.entity = 'StockItem'
          GROUP BY s.data->>'part', p.data->>'partNo'
          ORDER BY p.data->>'partNo' NULLS LAST, s.data->>'part'`,
        [blueprintId, organizationId],
      )) as InTransitAggRow[]
      return assembleInTransitView(rows)
    })
  }

  async viewReceivable(packageId: string, organizationId: string) {
    return this.runBuiltinView(packageId, organizationId, 'receivable', async (blueprintId) => {
      const template = this.readTemplate(packageId)
      const line = template.entities.find((item) => item.name === 'SalesOrderLine')
      const fallback = declaredMoneyCurrency(line?.fields ?? []) ?? 'CNY'
      const rows = (await this.dataSource.query(
        `SELECT o.data->>'customer' AS "customerId",
                c.data->>'name' AS "customerName",
                COALESCE(NULLIF(l.data->>'${STAMPED_CURRENCY_KEY}', ''), $3) AS currency,
                COALESCE(SUM(
                  (NULLIF(l.data->>'quantity', ''))::numeric
                  * (NULLIF(l.data->>'unitPrice', ''))::numeric
                ), 0)::text AS receivable
           FROM public.blueprint_records o
           INNER JOIN public.blueprint_records l
             ON l.entity = 'SalesOrderLine'
            AND l."blueprintId" = $1
            AND l."organizationId" = $2
            AND l.data->>'order' = o.id::text
           LEFT JOIN public.blueprint_records c
             ON c.entity = 'Customer'
            AND c."blueprintId" = $1
            AND c."organizationId" = $2
            AND c.id::text = o.data->>'customer'
          WHERE o."blueprintId" = $1
            AND o."organizationId" = $2
            AND o.entity = 'SalesOrder'
            AND o.state IN ('confirmed', 'shipped')
          GROUP BY o.data->>'customer', c.data->>'name',
                   COALESCE(NULLIF(l.data->>'${STAMPED_CURRENCY_KEY}', ''), $3)
          ORDER BY COALESCE(NULLIF(l.data->>'${STAMPED_CURRENCY_KEY}', ''), $3),
                   c.data->>'name' NULLS LAST, o.data->>'customer'`,
        [blueprintId, organizationId, fallback],
      )) as ReceivableAggRow[]
      return assembleReceivableView(rows)
    })
  }

  async transition(
    packageId: string,
    entity: string,
    recordId: string,
    body: { to?: unknown; expectedVersion?: unknown },
    organizationId: string,
    actor?: string,
    user?: RuntimeActor,
  ): Promise<TransitionResult> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝迁移', 'missing-tenant')
    }
    if (typeof body.to !== 'string' || body.to.length === 0) {
      throw new RecordWriteError('迁移目标 to 必须是非空字符串', 'invalid-transition', 'to')
    }
    const expectedVersion =
      body.expectedVersion === undefined ? undefined : this.parseExpectedVersion(body.expectedVersion)

    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BlueprintRecord)
      const row = await repo.findOne({
        where: {
          id: recordId,
          entity,
          blueprintId: loaded.manifest.blueprint,
          organizationId,
        },
      })
      if (!row) {
        throw new RecordWriteError(`记录 ${entity}:${recordId} 不存在`, 'not-found')
      }

      assertRecordStateDeclared(declared, row.state)
      const { from } = assertTransitionLegal(declared, row.state, body.to as string)
      await this.assertApprovalsAllowTransition(
        manager,
        loaded.manifest.blueprint,
        organizationId,
        entity,
        row,
        template,
      )

      const qb = repo
        .createQueryBuilder()
        .update(BlueprintRecord)
        .set({ state: body.to as string, version: () => '"version" + 1' })
        .where('id = :id', { id: recordId })
        .andWhere('entity = :entity', { entity })
        .andWhere('"blueprintId" = :blueprintId', { blueprintId: loaded.manifest.blueprint })
        .andWhere('"organizationId" = :organizationId', { organizationId })
      if (expectedVersion !== undefined) {
        qb.andWhere('version = :expectedVersion', { expectedVersion })
      }
      const result = await qb.execute()
      if (!result.affected) {
        if (expectedVersion !== undefined) {
          throw new RecordWriteError(
            `并发修改：期望版本 ${expectedVersion} 与实际不符`,
            'version-conflict',
            undefined,
            undefined,
            409,
          )
        }
        throw new RecordWriteError(`记录 ${entity}:${recordId} 不存在`, 'not-found')
      }

      await this.auditLogs.create({
        action: 'blueprint.record.transition',
        resource: entity,
        resourceId: recordId,
        actor: actor && actor.length > 0 ? actor : 'semantic-runtime',
        status: 'success',
        organizationId,
        changes: { from, to: body.to },
        metadata: {
          blueprintId: loaded.manifest.blueprint,
          from,
          to: body.to,
          entity,
          recordId,
        },
      })

      const updated = await repo.findOneByOrFail({ id: recordId })
      const journalEntries = await this.postAccounting(
        manager,
        loaded.manifest.blueprint,
        loaded.manifest.version,
        organizationId,
        entity,
        updated,
        body.to as string,
        template,
        actor,
      )
      return Object.assign(this.withResolvedState(updated, declared, user), { journalEntries })
    })
  }

  async listApprovals(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
  ): Promise<{ approvals: ApprovalChainView[] }> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取审批链', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    if (!template.entities.find((item) => item.name === entity)) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    const rows = await this.dataSource.getRepository(BlueprintApproval).find({
      where: {
        blueprintId: loaded.manifest.blueprint,
        organizationId,
        entity,
        recordId,
      },
      order: { ruleId: 'ASC', stepIndex: 'ASC' },
    })
    return { approvals: this.groupApprovalViews(rows) }
  }

  async approve(
    packageId: string,
    entity: string,
    recordId: string,
    ruleId: string,
    role: unknown,
    organizationId: string,
    actor?: string,
  ): Promise<ApprovalChainView> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝审批', 'missing-tenant')
    }
    if (typeof role !== 'string' || role.length === 0) {
      throw new RecordWriteError('审批 body.role 必须是非空字符串', 'approval-role-required', 'role')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    if (!template.entities.find((item) => item.name === entity)) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    const who = actor && actor.length > 0 ? actor : 'semantic-runtime'
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BlueprintApproval)
      const rows = await repo.find({
        where: {
          blueprintId: loaded.manifest.blueprint,
          organizationId,
          entity,
          recordId,
          ruleId,
        },
        order: { stepIndex: 'ASC' },
      })
      const steps: ApprovalStepState[] = rows.map((row) => ({
        index: row.stepIndex,
        role: row.role,
        status: row.status,
        actor: row.actor,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      }))
      const decidedAt = new Date()
      const result = applyApprove(steps, role, who, decidedAt.toISOString())
      if (!result.ok) {
        if (result.reason === 'role-mismatch') {
          throw new RecordWriteError(
            `审批角色不符：期望 ${result.expectedRole}，实际 ${result.actualRole}`,
            'approval-role-mismatch',
            undefined,
            ruleId,
            403,
          )
        }
        throw new RecordWriteError(
          result.reason === 'not-found'
            ? `审批链不存在：${ruleId}`
            : result.reason === 'already-approved'
              ? `审批链已全批：${ruleId}`
              : `审批链已拒绝：${ruleId}`,
          result.reason,
          undefined,
          ruleId,
        )
      }
      for (const step of result.steps) {
        const row = rows.find((item) => item.stepIndex === step.index)
        if (!row) continue
        row.status = step.status
        row.actor = step.actor
        row.decidedAt = step.decidedAt ? new Date(step.decidedAt) : undefined
        await repo.save(row)
      }
      await this.auditLogs.create({
        action: 'blueprint.record.approval',
        resource: entity,
        resourceId: recordId,
        actor: who,
        status: 'success',
        organizationId,
        metadata: {
          blueprintId: loaded.manifest.blueprint,
          ruleId,
          role,
          stepIndex: result.steps.find((step) => step.actor === who && step.status === 'approved')
            ?.index,
          result: result.chainStatus,
          actor: who,
        },
      })
      return toChainView(ruleId, result.steps)
    })
  }

  async remove(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
  ): Promise<{ id: string; deleted: true }> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝删除', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BlueprintRecord)
      const row = await repo.findOne({
        where: {
          id: recordId,
          entity,
          blueprintId: loaded.manifest.blueprint,
          organizationId,
        },
      })
      if (!row) {
        throw new RecordWriteError(`记录 ${entity}:${recordId} 不存在`, 'not-found')
      }
      await deleteRecordWithIntegrity(manager, {
        blueprintId: loaded.manifest.blueprint,
        organizationId,
        entity,
        recordId,
        entities: template.entities,
        validation: template.validation,
      })
    })
    return { id: recordId, deleted: true }
  }

  private async ensureApprovalChains(
    manager: EntityManager,
    blueprintId: string,
    blueprintVersion: string,
    organizationId: string,
    entity: string,
    recordId: string,
    data: Record<string, unknown>,
    template: LoadedTemplate,
  ): Promise<void> {
    const rules = template.approval.filter((rule) => rule.entity === entity)
    if (rules.length === 0) return
    const ctx = await this.evalContextOf(manager, blueprintId, organizationId, entity, recordId, data, template)
    const repo = manager.getRepository(BlueprintApproval)
    for (const rule of rules) {
      const judged = evaluateCondition(rule.when, ctx)
      if (!judged.ok) {
        throw new RecordWriteError(`审批条件求值失败：${judged.error}`, 'approval-eval-failed', undefined, rule.id)
      }
      if (!judged.value) continue
      const existing = await repo.find({
        where: { blueprintId, organizationId, entity, recordId, ruleId: rule.id },
        order: { stepIndex: 'ASC' },
      })
      if (existing.length > 0) continue
      for (const step of buildPendingSteps(rule)) {
        await repo.save(
          repo.create({
            blueprintId,
            blueprintVersion,
            organizationId,
            entity,
            recordId,
            ruleId: rule.id,
            stepIndex: step.index,
            role: step.role,
            status: 'pending',
          }),
        )
      }
    }
  }

  private async assertApprovalsAllowTransition(
    manager: EntityManager,
    blueprintId: string,
    organizationId: string,
    entity: string,
    row: BlueprintRecord,
    template: LoadedTemplate,
  ): Promise<void> {
    const rules = template.approval.filter((rule) => rule.entity === entity)
    if (rules.length === 0) return
    const ctx = await this.evalContextOf(
      manager,
      blueprintId,
      organizationId,
      entity,
      row.id,
      row.data,
      template,
    )
    const repo = manager.getRepository(BlueprintApproval)
    for (const rule of rules) {
      const judged = evaluateCondition(rule.when, ctx)
      if (!judged.ok) {
        throw new RecordWriteError(`审批条件求值失败：${judged.error}`, 'approval-eval-failed', undefined, rule.id)
      }
      if (!judged.value) continue
      const existing = await repo.find({
        where: { blueprintId, organizationId, entity, recordId: row.id, ruleId: rule.id },
        order: { stepIndex: 'ASC' },
      })
      const steps: ApprovalStepState[] = existing.map((item) => ({
        index: item.stepIndex,
        role: item.role,
        status: item.status,
        actor: item.actor,
        decidedAt: item.decidedAt ? item.decidedAt.toISOString() : null,
      }))
      if (isFullyApproved(steps)) continue
      const pending = steps.find((step) => step.status === 'pending')
      throw new RecordWriteError(
        `需要审批：规则 ${rule.id}，当前待审角色 ${pending?.role ?? rule.steps[0]?.role}`,
        'approval-required',
        undefined,
        rule.id,
      )
    }
  }

  private async postAccounting(
    manager: EntityManager,
    blueprintId: string,
    blueprintVersion: string,
    organizationId: string,
    entity: string,
    row: BlueprintRecord,
    toState: string,
    template: LoadedTemplate,
    actor?: string,
  ): Promise<TransitionResult['journalEntries']> {
    const event = `${entity}.${toState}`
    const rules = template.accounting.filter((rule) => rule.on === event)
    if (rules.length === 0) return []
    const ctx = await this.evalContextOf(
      manager,
      blueprintId,
      organizationId,
      entity,
      row.id,
      row.data,
      template,
    )
    const repo = manager.getRepository(BlueprintJournalEntry)
    const posted: TransitionResult['journalEntries'] = []
    for (const rule of rules) {
      try {
        const drafts = generateEntries(rule, ctx.values)
        assertBalanced(rule.id, drafts)
        for (const draft of drafts) {
          const saved = await repo.save(
            repo.create({
              blueprintId,
              blueprintVersion,
              organizationId,
              ruleId: draft.ruleId,
              event: draft.event,
              entity,
              recordId: row.id,
              account: draft.account,
              side: draft.side,
              amountUnits: draft.amount.units.toString(),
              scale: draft.amount.scale,
            }),
          )
          posted.push({
            ruleId: saved.ruleId,
            event: saved.event,
            account: saved.account,
            side: saved.side,
            amount: formatFixed(draft.amount),
            scale: saved.scale,
          })
        }
      } catch (error) {
        if (error instanceof AccountingError) {
          throw new RecordWriteError(error.message, 'accounting-unbalanced', undefined, rule.id)
        }
        throw error
      }
    }
    await this.auditLogs.create({
      action: 'blueprint.record.accounting',
      resource: entity,
      resourceId: row.id,
      actor: actor && actor.length > 0 ? actor : 'semantic-runtime',
      status: 'success',
      organizationId,
      metadata: { blueprintId, event, entity, recordId: row.id, entries: posted },
    })
    return posted
  }

  private async evalContextOf(
    manager: EntityManager,
    blueprintId: string,
    organizationId: string,
    entity: string,
    recordId: string,
    data: Record<string, unknown>,
    template: LoadedTemplate,
  ) {
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    const childRows: Record<string, Array<Record<string, unknown>>> = {}
    for (const childName of declared.children ?? []) {
      const child = template.entities.find((item) => item.name === childName)
      const parentField = child?.parent?.field
      if (!parentField) continue
      const rows = await manager.getRepository(BlueprintRecord).find({
        where: { blueprintId, organizationId, entity: childName },
      })
      childRows[childName] = rows
        .filter((item) => item.data[parentField] === recordId)
        .map((item) => item.data)
    }
    return buildEvalContext(declared, data, childRows, template.entities)
  }

  private groupApprovalViews(rows: BlueprintApproval[]): ApprovalChainView[] {
    const byRule = new Map<string, ApprovalStepState[]>()
    for (const row of rows) {
      const list = byRule.get(row.ruleId) ?? []
      list.push({
        index: row.stepIndex,
        role: row.role,
        status: row.status,
        actor: row.actor,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      })
      byRule.set(row.ruleId, list)
    }
    return [...byRule.entries()].map(([ruleId, steps]) => toChainView(ruleId, steps))
  }

  private parseExpectedVersion(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new RecordWriteError('expectedVersion 必须是正整数', 'invalid-transition', 'expectedVersion')
    }
    return value
  }

  private async runBuiltinView<T>(
    packageId: string,
    organizationId: string,
    view: 'stock' | 'in-transit' | 'receivable',
    query: (blueprintId: string) => Promise<T>,
  ): Promise<T> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const result = await query(loaded.manifest.blueprint)
    await this.auditLogs.create({
      action: `blueprint.view.${view}`,
      resource: view,
      actor: 'semantic-runtime',
      status: 'success',
      organizationId,
      metadata: { blueprintId: loaded.manifest.blueprint, view },
    })
    return result
  }

  private withResolvedState(
    row: BlueprintRecord,
    entity: SemanticEntity,
    actor?: RuntimeActor,
  ): BlueprintRecord {
    const resolved = resolveState(row.state, entity)
    if (resolved !== undefined) {
      row.state = resolved
    }
    const materialized = materializeDefaults(entity, row.data ?? {})
    const omitted = omitRestrictedFields(entity, materialized, actorPermissions(actor))
    row.data = omitted.data
    Object.assign(row, { omittedFields: omitted.omittedFields })
    return row
  }

  private assertWritablePayload(
    entities: SemanticEntity[],
    entityName: string,
    data: Record<string, unknown>,
    actor?: RuntimeActor,
  ): void {
    const granted = actorPermissions(actor)
    const declared = entities.find((item) => item.name === entityName)
    if (!declared) return
    const forbidden = forbiddenWriteFields(declared, data, granted)
    if (forbidden.length > 0) {
      throw new RecordWriteError(
        `无权写入字段 ${entityName}.${forbidden[0]}`,
        'forbidden-field',
        forbidden[0],
        undefined,
        403,
      )
    }
    const children = data.children
    if (!children || typeof children !== 'object' || Array.isArray(children)) return
    for (const [childName, rows] of Object.entries(children as Record<string, unknown>)) {
      if (!Array.isArray(rows)) continue
      const child = entities.find((item) => item.name === childName)
      if (!child) continue
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue
        const childForbidden = forbiddenWriteFields(child, row as Record<string, unknown>, granted)
        if (childForbidden.length > 0) {
          throw new RecordWriteError(
            `无权写入字段 ${childName}.${childForbidden[0]}`,
            'forbidden-field',
            childForbidden[0],
            undefined,
            403,
          )
        }
      }
    }
  }

  private async listEnvelope(
    blueprintId: string,
    entity: SemanticEntity,
    organizationId: string,
    query: Record<string, string | undefined>,
    actor?: RuntimeActor,
  ): Promise<QueryEnvelope<BlueprintRecord>> {
    const parsed = parseRecordQuery(entity, query)
    const params: unknown[] = [blueprintId, organizationId, entity.name]
    const clauses = ['"blueprintId" = $1', '"organizationId" = $2', 'entity = $3']
    let next = 4
    if (entity.ownership && !canReadAllOwned(entity, actorPermissions(actor))) {
      const field = entity.ownership.field
      const who = actorId(actor) ?? ''
      clauses.push(
        `(data->>'${field}' IS NULL OR data->>'${field}' = '' OR data->>'${field}' = $${next})`,
      )
      params.push(who)
      next += 1
    }

    if (parsed.state !== null) {
      const initial = initialStateOf(entity)
      clauses.push(`(state = $${next} OR (state IS NULL AND $${next} = $${next + 1}))`)
      params.push(parsed.state, initial ?? '')
      next += 2
    }

    const filter = filterSql(entity, parsed.filter, next)
    if (filter.clause) {
      clauses.push(filter.clause)
      params.push(...filter.params)
      next = filter.nextIndex
    }

    const where = clauses.join(' AND ')
    const sort = parsed.sort ?? 'createdAt'
    const order = (parsed.order ?? 'asc').toUpperCase()
    const sortExpr = sortSqlExpression(entity, sort)
    const offset = (parsed.page - 1) * parsed.pageSize

    const countRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM public.blueprint_records WHERE ${where}`,
      params,
    )) as Array<{ total: number }>
    const total = countRows[0]?.total ?? 0

    const items = (await this.dataSource.query(
      `SELECT * FROM public.blueprint_records
        WHERE ${where}
        ORDER BY ${sortExpr} ${order}, id ASC
        LIMIT $${next} OFFSET $${next + 1}`,
      [...params, parsed.pageSize, offset],
    )) as BlueprintRecord[]

    return {
      items: items.map((row) => this.withResolvedState(row, entity, actor)),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      sort: parsed.sort,
      order: parsed.order,
    }
  }

  /**
   * 幂等应用模板声明的唯一索引。
   *
   * **按 `blueprintId@version` 记忆成功结果**：DDL 本身幂等，但"冲突清单 + 建索引"每次写都跑一遍，
   * 等于给写入路径挂上一次全表 group-by —— 30 次顺序写入就足以撞上测试超时（实测如此）。
   * 失败结果**不缓存**：冲突数据可能被清掉，下一次写必须重新判定。
   */
  private readonly appliedIndexKeys = new Set<string>()

  private async applyIndexesOrThrow(
    blueprintId: string,
    version: string,
    entities: DocumentEntity[],
  ): Promise<void> {
    const key = `${blueprintId}@${version}`
    if (this.appliedIndexKeys.has(key)) return

    const semantic = { entities }
    const conflicts = await applyUniqueIndexes(this.dataSource, blueprintId, semantic)
    if (conflicts.length > 0) {
      const list = conflicts
        .map(
          (item) =>
            `租户 ${item.organizationId} 的 ${item.entity}.${item.field}=${item.value} ids=${item.ids.join(',')}`,
        )
        .join('; ')
      throw new RecordWriteError(`唯一约束冲突，拒绝建索引：${list}`, 'unique-conflict')
    }
    const notNull = await applyNotNullConstraints(this.dataSource, blueprintId, semantic)
    if (notNull.length > 0) {
      const list = notNull
        .map(
          (item) =>
            `租户 ${item.organizationId} 的 ${item.entity}.${item.field} 空值 ids=${item.ids.join(',')}`,
        )
        .join('; ')
      throw new RecordWriteError(`非空约束冲突，拒绝建约束：${list}`, 'not-null-conflict')
    }
    this.appliedIndexKeys.add(key)
  }

  private async loadOrThrow(packageId: string, organizationId: string) {
    try {
      return await this.blueprints.load(packageId, { tenantId: organizationId })
    } catch (error) {
      if (
        error instanceof LoadError ||
        error instanceof CompileError ||
        error instanceof PackageError ||
        error instanceof NotFoundException
      ) {
        throw error
      }
      throw error
    }
  }

  private readTemplate(packageId: string): LoadedTemplate {
    const path = join(this.blueprints.packagesDirectory(), `${packageId}.erpkg`)
    const unpacked = unpackBlueprint(path)
    const semanticBytes = unpacked.files.get('semantic.json')
    if (!semanticBytes) {
      throw new RecordWriteError('包内缺少 semantic.json', 'unknown-entity')
    }
    const semantic = JSON.parse(semanticBytes.toString('utf8')) as SemanticFile
    const rulesBytes = unpacked.files.get('rules.json')
    const rules = rulesBytes
      ? (JSON.parse(rulesBytes.toString('utf8')) as RulesFile)
      : { validation: [] }
    return {
      entities: semantic.entities,
      validation: rules.validation ?? [],
      approval: rules.approval ?? [],
      accounting: rules.accounting ?? [],
    }
  }
}
