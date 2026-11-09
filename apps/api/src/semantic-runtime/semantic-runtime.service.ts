import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager, In, Repository } from 'typeorm'
import { join } from 'node:path'
import { AuditLog } from '../audit-logs/audit-log.entity'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { logApprove, logImportMaster, logTransition } from '../common/logging/structured-logger'
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
  currentPendingStep,
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
import { applyQueryIndexes } from './query-index'
import { canAccessBlueprintResource } from '@sap/shared-core'
import {
  initialStateOf,
  resolveState,
  writeDocumentOrRecord,
  type DocumentEntity,
} from './document-writer'
import { buildEvalContext } from './eval-context'
import {
  assembleSuggestedTransitions,
  assembleTransitionHistory,
  TRANSITION_AUDIT_ACTION,
  TRANSITION_AUDIT_SOURCE_BLUEPRINT,
  type ApprovalJudgement,
  type SuggestedTransitionItem,
  type TransitionHistoryItem,
} from './record-history'
import { allowedTargetsOf, assertRecordStateDeclared, assertTransitionLegal } from './record-transition'
import {
  selectAutoSuggestTargets,
  type AutoSuggestTarget,
} from './suggestion-targets'
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
import { DataScopeService } from '../data-scope/data-scope.service'
import { compileScopeExpr } from '../data-scope/scope-sql-compiler'
import type { ScopeBindingView, ScopeSpec } from '../data-scope/data-scope.types'
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
import {
  approvalDecidedIdempotencyKey,
  approvalPendingIdempotencyKey,
  importIdempotencyKey,
  OutboxService,
  transitionIdempotencyKey,
} from '../outbox/outbox.service'

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

/** 状态图 / 实体选择器要的语义切片：不含字段细节。 */
export interface SemanticStateDecl {
  name: string
  initial: boolean
  final: boolean
}

export interface SemanticTransitionDecl {
  from: string
  to: string
}

export interface SemanticEntityDecl {
  name: string
  children?: string[]
  states: SemanticStateDecl[]
  transitions: SemanticTransitionDecl[]
}

export interface SemanticDeclaration {
  entities: SemanticEntityDecl[]
}

/** 模板实体 → 图所需的 states / transitions / children；不带字段。 */
export function projectSemanticDeclaration(
  entities: Array<{
    name: string
    children?: string[]
    states?: Array<{ name: string; initial?: boolean; final?: boolean }>
    transitions?: Array<{ from: string; to: string }>
  }>,
): SemanticDeclaration {
  return {
    entities: entities.map((entity) => ({
      name: entity.name,
      ...(entity.children && entity.children.length > 0 ? { children: [...entity.children] } : {}),
      states: (entity.states ?? []).map((state) => ({
        name: state.name,
        initial: state.initial === true,
        final: state.final === true,
      })),
      transitions: (entity.transitions ?? []).map((item) => ({ from: item.from, to: item.to })),
    })),
  }
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
    private readonly outbox: OutboxService,
    private readonly dataScope: DataScopeService,
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
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    this.assertEntityAccess(loaded, entity, 'create', actor)
    this.assertWritablePayload(template.entities, entity, data, actor)
    await this.assertCreateInDataScope(
      loaded.manifest.blueprint,
      declared,
      data,
      organizationId,
      actor,
    )
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
    const batchScope = await this.dataScopeSqlFor(
      packageId,
      'Batch',
      organizationId,
      actor,
      'list',
      'blueprint_records',
      3,
    )
    const batches = batchScope?.none
      ? []
      : ((await this.dataSource.query(
          `SELECT id, data FROM public.blueprint_records
            WHERE "blueprintId" = $1 AND "organizationId" = $2
              AND entity = 'Batch' AND data->>'batchNo' = $3
              ${batchScope ? `AND (${batchScope.sql})` : ''}
            ORDER BY id ASC`,
          [loaded.manifest.blueprint, organizationId, batchNo, ...(batchScope?.params ?? [])],
        )) as RelatedRecord[])

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
    this.assertEntityAccess(loaded, entity, 'create', actor)
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
        await this.assertCreateInDataScope(
          loaded.manifest.blueprint,
          declared,
          row.data,
          organizationId,
          actor,
        )
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

    const batchId = randomUUID()
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
        batchId,
      },
    })
    await this.dataSource.transaction(async (manager) => {
      await this.outbox.publish(manager, {
        topic: 'blueprint.import.completed',
        organizationId,
        idempotencyKey: importIdempotencyKey(entity, batchId),
        payload: {
          entity,
          imported,
          failed,
          dryRun,
          batchId,
          actor: actorId(actor) ?? 'semantic-runtime',
        },
      })
    })

    logImportMaster({ entity, imported, failed, dryRun })
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
    const params: unknown[] = [blueprintId, organizationId, entity, ids]
    let where =
      '"blueprintId" = $1 AND "organizationId" = $2 AND entity = $3 AND id = ANY($4::uuid[])'
    if (declared) {
      const scope = await this.resolveBlueprintDataScope(
        blueprintId,
        declared,
        organizationId,
        actor,
        'list',
      )
      if (scope?.expr.op === 'none') return found
      if (scope && scope.expr.op !== 'all') {
        const compiled = compileScopeExpr(scope.expr, {
          alias: 'blueprint_records',
          rowAlias: 'blueprint_records',
          organizationId,
          actorId: actorId(actor) ?? '',
          paramOffset: params.length,
        })
        where += ` AND (${compiled.sql})`
        params.push(...compiled.params)
      }
    }
    const rows = (await this.dataSource.query(
      `SELECT id, data FROM public.blueprint_records
        WHERE ${where}`,
      params,
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
    this.assertEntityAccess(loaded, entity, ['list', 'read'], actor)

    if (!hasQueryParams(query)) {
      if (declared.dataScope) {
        return this.listAllWithDataScope(
          loaded.manifest.blueprint,
          declared,
          organizationId,
          actor,
        )
      }
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

  /**
   * 已装载模板的语义声明（只读）：授权门走 loadOrThrow，内容走 readTemplate。
   * 不重新编译、不写审计、不返回字段细节。
   */
  async semantic(packageId: string, organizationId: string): Promise<SemanticDeclaration> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    await this.loadOrThrow(packageId, organizationId)
    return projectSemanticDeclaration(this.readTemplate(packageId).entities)
  }

  /**
   * 单条记录读：与 list 同一套后处理（resolveState + materializeDefaults + 字段省略）。
   * 租户过滤；找不到 / 他租 → 404。
   */
  async read(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
    actor?: RuntimeActor,
  ): Promise<BlueprintRecord> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    this.assertEntityAccess(loaded, entity, 'read', actor)
    const row = await this.findRecordOrThrow(loaded.manifest.blueprint, organizationId, entity, recordId)
    await this.assertRecordInDataScope(
      loaded.manifest.blueprint,
      declared,
      row,
      organizationId,
      actor,
      'read',
    )
    return this.withResolvedState(row, declared, actor)
  }

  async viewStock(packageId: string, organizationId: string, actor?: RuntimeActor) {
    return this.runBuiltinView(packageId, organizationId, 'stock', async (blueprintId) => {
      const scope = await this.dataScopeSqlFor(
        packageId,
        'StockItem',
        organizationId,
        actor,
        'list',
        's',
        2,
      )
      if (scope?.none) return []
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
            ${scope ? `AND (${scope.sql})` : ''}
          GROUP BY s.data->>'part', p.data->>'partNo'
          ORDER BY p.data->>'partNo' NULLS LAST, s.data->>'part'`,
        [blueprintId, organizationId, ...(scope?.params ?? [])],
      )) as StockAggRow[]
      return assembleStockView(rows)
    })
  }

  async viewInTransit(packageId: string, organizationId: string, actor?: RuntimeActor) {
    return this.runBuiltinView(packageId, organizationId, 'in-transit', async (blueprintId) => {
      const scope = await this.dataScopeSqlFor(
        packageId,
        'StockItem',
        organizationId,
        actor,
        'list',
        's',
        2,
      )
      if (scope?.none) return []
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
            ${scope ? `AND (${scope.sql})` : ''}
          GROUP BY s.data->>'part', p.data->>'partNo'
          ORDER BY p.data->>'partNo' NULLS LAST, s.data->>'part'`,
        [blueprintId, organizationId, ...(scope?.params ?? [])],
      )) as InTransitAggRow[]
      return assembleInTransitView(rows)
    })
  }

  async viewReceivable(packageId: string, organizationId: string, actor?: RuntimeActor) {
    return this.runBuiltinView(packageId, organizationId, 'receivable', async (blueprintId) => {
      const template = this.readTemplate(packageId)
      const line = template.entities.find((item) => item.name === 'SalesOrderLine')
      const fallback = declaredMoneyCurrency(line?.fields ?? []) ?? 'CNY'
      const scope = await this.dataScopeSqlFor(
        packageId,
        'SalesOrder',
        organizationId,
        actor,
        'list',
        'o',
        3,
      )
      if (scope?.none) return []
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
            ${scope ? `AND (${scope.sql})` : ''}
          GROUP BY o.data->>'customer', c.data->>'name',
                   COALESCE(NULLIF(l.data->>'${STAMPED_CURRENCY_KEY}', ''), $3)
          ORDER BY COALESCE(NULLIF(l.data->>'${STAMPED_CURRENCY_KEY}', ''), $3),
                   c.data->>'name' NULLS LAST, o.data->>'customer'`,
        [blueprintId, organizationId, fallback, ...(scope?.params ?? [])],
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
    this.assertEntityAccess(loaded, entity, 'update', user)
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

      await this.assertRecordInDataScope(
        loaded.manifest.blueprint,
        declared,
        row,
        organizationId,
        user,
        'update',
        manager,
      )

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
          source: TRANSITION_AUDIT_SOURCE_BLUEPRINT,
        },
      })

      const updated = await repo.findOneByOrFail({ id: recordId })
      // 先发事件再记账：记账不平衡必须回滚事件（N0 判据：发布先于失败）。
      await this.outbox.publish(manager, {
        topic: 'blueprint.record.transitioned',
        organizationId,
        aggregateType: entity,
        aggregateId: recordId,
        idempotencyKey: transitionIdempotencyKey(recordId, from, body.to as string, updated.version),
        payload: {
          blueprintId: loaded.manifest.blueprint,
          entity,
          recordId,
          from,
          to: body.to,
          version: updated.version,
          actor: actor && actor.length > 0 ? actor : 'semantic-runtime',
        },
      })
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
      logTransition({
        blueprintId: loaded.manifest.blueprint,
        entity,
        recordId,
        from,
        to: body.to as string,
        version: updated.version,
      })
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

  /** 按实例读迁移历史：来源是 audit_logs，无历史返回 []，记录不存在 404。 */
  async listTransitionHistory(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
  ): Promise<TransitionHistoryItem[]> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    if (!template.entities.find((item) => item.name === entity)) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    await this.findRecordOrThrow(loaded.manifest.blueprint, organizationId, entity, recordId)
    const rows = await this.dataSource.getRepository(AuditLog).find({
      where: {
        action: TRANSITION_AUDIT_ACTION,
        resource: entity,
        resourceId: recordId,
        organizationId,
      },
      order: { timestamp: 'ASC' },
    })
    return assembleTransitionHistory(rows)
  }

  /**
   * 建议迁移：只读。依据当前模板 transitions + 既有审批求值，不改 state/version、不写审计。
   */
  async listSuggestedTransitions(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
    actor?: RuntimeActor,
  ): Promise<SuggestedTransitionItem[]> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    const template = this.readTemplate(packageId)
    const declared = template.entities.find((item) => item.name === entity)
    if (!declared) {
      throw new RecordWriteError(`模板未声明实体 ${entity}`, 'unknown-entity')
    }
    this.assertEntityAccess(loaded, entity, 'read', actor)
    const row = await this.findRecordOrThrow(loaded.manifest.blueprint, organizationId, entity, recordId)
    assertRecordStateDeclared(declared, row.state)
    const from = resolveState(row.state, declared)
    const targets = from ? allowedTargetsOf(declared, from) : []
    const ctx = await this.evalContextOf(
      this.dataSource.manager,
      loaded.manifest.blueprint,
      organizationId,
      entity,
      row.id,
      row.data,
      template,
    )
    const approvalRepo = this.dataSource.getRepository(BlueprintApproval)
    const judgements: ApprovalJudgement[] = []
    for (const rule of template.approval.filter((item) => item.entity === entity)) {
      const judged = evaluateCondition(rule.when, ctx)
      if (!judged.ok) {
        throw new RecordWriteError(
          `审批条件求值失败：${judged.error}`,
          'approval-eval-failed',
          undefined,
          rule.id,
        )
      }
      if (!judged.value) {
        judgements.push({ ruleId: rule.id, applies: false, fullyApproved: false })
        continue
      }
      const existing = await approvalRepo.find({
        where: {
          blueprintId: loaded.manifest.blueprint,
          organizationId,
          entity,
          recordId: row.id,
          ruleId: rule.id,
        },
        order: { stepIndex: 'ASC' },
      })
      const steps: ApprovalStepState[] = existing.map((item) => ({
        index: item.stepIndex,
        role: item.role,
        status: item.status,
        actor: item.actor,
        decidedAt: item.decidedAt ? item.decidedAt.toISOString() : null,
      }))
      const pending = currentPendingStep(steps)
      judgements.push({
        ruleId: rule.id,
        applies: true,
        fullyApproved: isFullyApproved(steps),
        pendingRole: pending?.role ?? rule.steps[0]?.role,
      })
    }
    return assembleSuggestedTransitions(targets, judgements)
  }

  /**
   * 夜间建议的扫描面：已安装包里 `autoSuggest === true` 的非终态记录。
   * 坏包跳过，不让一个包挡住整批。
   */
  async listAutoSuggestTargets(organizationId?: string): Promise<AutoSuggestTarget[]> {
    const packages: Array<{
      packageId: string
      blueprintId: string
      entities: LoadedTemplate['entities']
    }> = []
    for (const pkg of this.blueprints.list()) {
      try {
        const template = this.readTemplate(pkg.id)
        packages.push({
          packageId: pkg.id,
          blueprintId: pkg.manifest.blueprint,
          entities: template.entities,
        })
      } catch (error) {
        new Logger(SemanticRuntimeService.name).warn(
          `跳过无法读取语义的包 ${pkg.id}：${(error as Error).message}`,
        )
      }
    }
    if (packages.length === 0) return []
    const rows = await this.records.find({
      where: {
        blueprintId: In(packages.map((pkg) => pkg.blueprintId)),
        ...(organizationId ? { organizationId } : {}),
      },
    })
    return selectAutoSuggestTargets(packages, rows)
  }

  private async findRecordOrThrow(
    blueprintId: string,
    organizationId: string,
    entity: string,
    recordId: string,
  ): Promise<BlueprintRecord> {
    const row = await this.records.findOne({
      where: { id: recordId, entity, blueprintId, organizationId },
    })
    if (!row) {
      throw new NotFoundException(`记录 ${entity}:${recordId} 不存在`)
    }
    return row
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
      const decidedStep = result.steps.find((step) => step.actor === who && step.status === 'approved')
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
          stepIndex: decidedStep?.index,
          result: result.chainStatus,
          actor: who,
        },
      })
      await this.outbox.publish(manager, {
        topic: 'blueprint.record.approval.decided',
        organizationId,
        aggregateType: entity,
        aggregateId: recordId,
        idempotencyKey: approvalDecidedIdempotencyKey(recordId, ruleId, decidedStep?.index ?? 0),
        payload: {
          ruleId,
          role,
          stepIndex: decidedStep?.index ?? 0,
          entity,
          recordId,
          result: result.chainStatus,
          actor: who,
        },
      })
      logApprove({
        ruleId,
        stepIndex: decidedStep?.index ?? 0,
        role,
        result: result.chainStatus,
      })
      return toChainView(ruleId, result.steps)
    })
  }

  async remove(
    packageId: string,
    entity: string,
    recordId: string,
    organizationId: string,
    actor?: RuntimeActor,
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
    this.assertEntityAccess(loaded, entity, 'delete', actor)

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
      await this.assertRecordInDataScope(
        loaded.manifest.blueprint,
        declared,
        row,
        organizationId,
        actor,
        'delete',
        manager,
      )
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
      const pendingSteps = buildPendingSteps(rule)
      for (const step of pendingSteps) {
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
      const first = pendingSteps[0]
      if (first) {
        await this.outbox.publish(manager, {
          topic: 'blueprint.record.approval.pending',
          organizationId,
          aggregateType: entity,
          aggregateId: recordId,
          idempotencyKey: approvalPendingIdempotencyKey(recordId, rule.id, first.index),
          payload: {
            ruleId: rule.id,
            role: first.role,
            stepIndex: first.index,
            entity,
            recordId,
          },
        })
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

  /**
   * Blueprint 权限层：角色 → 资源 → 动作。
   * 无权限层或空规则时保持旧行为；有规则时按 roleMappings/JWT role/权限点匹配。
   */
  private assertEntityAccess(
    loaded: { compiled?: { permissions?: Parameters<typeof canAccessBlueprintResource>[0] } },
    entity: string,
    action: 'create' | 'read' | 'update' | 'delete' | 'list' | Array<'create' | 'read' | 'update' | 'delete' | 'list'>,
    actor?: RuntimeActor,
  ): void {
    const actions = Array.isArray(action) ? action : [action]
    const allowed = actions.some((candidate) =>
      canAccessBlueprintResource(
        loaded.compiled?.permissions,
        { role: actor?.role, permissions: actorPermissions(actor) },
        entity,
        candidate,
      ),
    )
    if (!allowed) {
      throw new RecordWriteError(
        `无权对 ${entity} 执行 ${actions.join('/')}（Blueprint 权限层拒绝）`,
        'forbidden',
        undefined,
        undefined,
        403,
        entity,
      )
    }
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

  private async dataScopeSqlFor(
    packageId: string,
    entityName: string,
    organizationId: string,
    actor: RuntimeActor | undefined,
    action: string,
    alias: string,
    paramOffset: number,
  ): Promise<{ sql: string; params: unknown[]; none: boolean } | null> {
    const entity = this.readTemplate(packageId).entities.find((item) => item.name === entityName)
    if (!entity?.dataScope) return null
    const scope = await this.resolveBlueprintDataScope(
      packageId,
      entity,
      organizationId,
      actor,
      action,
    )
    if (!scope || scope.expr.op === 'all') return null
    if (scope.expr.op === 'none') return { sql: '1=0', params: [], none: true }
    const compiled = compileScopeExpr(scope.expr, {
      alias,
      rowAlias: alias,
      organizationId,
      actorId: actorId(actor) ?? '',
      paramOffset,
    })
    return { sql: compiled.sql, params: compiled.params, none: false }
  }

  private async listAllWithDataScope(
    blueprintId: string,
    entity: SemanticEntity,
    organizationId: string,
    actor?: RuntimeActor,
  ): Promise<BlueprintRecord[]> {
    const params: unknown[] = [blueprintId, organizationId, entity.name]
    const clauses = ['"blueprintId" = $1', '"organizationId" = $2', 'entity = $3']
    const scope = await this.resolveBlueprintDataScope(
      blueprintId,
      entity,
      organizationId,
      actor,
      'list',
    )
    if (scope) {
      if (scope.expr.op === 'none') return []
      if (scope.expr.op !== 'all') {
        const compiled = compileScopeExpr(scope.expr, {
          alias: 'blueprint_records',
          rowAlias: 'blueprint_records',
          organizationId,
          actorId: actorId(actor) ?? '',
          paramOffset: params.length,
        })
        clauses.push(compiled.sql)
        params.push(...compiled.params)
      }
    }
    const rows = (await this.dataSource.query(
      `SELECT * FROM public.blueprint_records
        WHERE ${clauses.join(' AND ')}
        ORDER BY "createdAt" ASC`,
      params,
    )) as BlueprintRecord[]
    return filterOwnedRows(entity, rows, actor).map((row) =>
      this.withResolvedState(row, entity, actor),
    )
  }

  private async resolveBlueprintDataScope(
    blueprintId: string,
    entity: SemanticEntity,
    organizationId: string,
    actor: RuntimeActor | undefined,
    action: string,
  ) {
    const decl = entity.dataScope
    if (!decl) return null
    const resourceKey = `blueprint:${blueprintId}:${entity.name}`
    const bindings: ScopeBindingView[] = decl.bindings.map((binding) => ({
      resourceKey,
      dimensionKey: binding.dimension,
      kind: binding.kind,
      field: binding.field ?? null,
      relation: binding.relation ?? null,
    }))
    const loaded = await this.loadOrThrow(blueprintId, organizationId)
    const packageCap = this.permissionCapFor(
      loaded.compiled?.permissions,
      entity,
      action,
      actor,
    )
    return this.dataScope.resolve({
      organizationId,
      actor: {
        userId: actorId(actor) ?? '',
        roleKeys: actor?.role ? [actor.role] : [],
        groupKeys: [],
        permissions: actorPermissions(actor),
      },
      resourceKey,
      action,
      declared: true,
      bindings,
      packageCap,
    })
  }

  private permissionCapFor(
    layer:
      | {
          rules?: Array<{
            role: string
            scope: string
            resources: string[]
            actions?: string[]
            dataScope?: {
              dimension: string
              depth: 'exact' | 'subtree' | 'ancestors'
              positions?: string[]
              relation?: { entity?: string; table?: string; fromField: string; actorField: string }
            }
          }>
        }
      | null
      | undefined,
    entity: SemanticEntity,
    action: string,
    actor: RuntimeActor | undefined,
  ): ScopeSpec | null {
    if (!layer?.rules) return null
    for (const rule of layer.rules) {
      if (!rule.resources.includes('*') && !rule.resources.includes(entity.name)) continue
      if (rule.actions && !rule.actions.includes(action)) continue
      const roleMatches =
        actor?.role === rule.role || actorPermissions(actor).includes(rule.role)
      if (!roleMatches) continue

      if (rule.scope === 'all') return { kind: 'all' }
      if (rule.scope === 'own') return { kind: 'self' }
      if (rule.scope === 'team') {
        const dimension = entity.dataScope?.bindings[0]?.dimension
        if (!dimension) return null
        return { kind: 'node', dimension, anchor: 'membership', depth: 'exact' }
      }
      if (rule.scope === 'policy') {
        if (!rule.dataScope) return null
        if (rule.dataScope.relation) {
          return { kind: 'relation', relation: rule.dataScope.relation }
        }
        return {
          kind: 'node',
          dimension: rule.dataScope.dimension,
          anchor: 'membership',
          depth: rule.dataScope.depth,
          positions: rule.dataScope.positions,
        }
      }
      return null
    }
    return null
  }

  private async assertRecordInDataScope(
    blueprintId: string,
    entity: SemanticEntity,
    row: BlueprintRecord,
    organizationId: string,
    actor: RuntimeActor | undefined,
    action: string,
    manager?: EntityManager,
  ): Promise<void> {
    const scope = await this.resolveBlueprintDataScope(
      blueprintId,
      entity,
      organizationId,
      actor,
      action,
    )
    if (!scope || scope.expr.op === 'all') return
    if (scope.expr.op === 'none') {
      throw new NotFoundException('记录不存在或无权访问')
    }
    const compiled = compileScopeExpr(scope.expr, {
      alias: 'blueprint_records',
      rowAlias: 'blueprint_records',
      organizationId,
      actorId: actorId(actor) ?? '',
      paramOffset: 2,
    })
    const rows = (await (manager ?? this.dataSource).query(
      `SELECT 1 FROM public.blueprint_records
        WHERE id = $1 AND "organizationId" = $2 AND (${compiled.sql})
        LIMIT 1`,
      [row.id, organizationId, ...compiled.params],
    )) as Array<{ '?column?': number }>
    if (rows.length === 0) {
      throw new NotFoundException('记录不存在或无权访问')
    }
  }

  private async assertCreateInDataScope(
    blueprintId: string,
    entity: SemanticEntity,
    data: Record<string, unknown>,
    organizationId: string,
    actor: RuntimeActor | undefined,
  ): Promise<void> {
    const scope = await this.resolveBlueprintDataScope(
      blueprintId,
      entity,
      organizationId,
      actor,
      'create',
    )
    if (!scope || scope.expr.op === 'all') return
    if (scope.expr.op === 'none') {
      throw new RecordWriteError('无权在该范围内创建记录', 'data-scope-denied', undefined, undefined, 403)
    }
    const compiled = compileScopeExpr(scope.expr, {
      alias: 'blueprint_records',
      rowAlias: 'blueprint_records',
      organizationId,
      actorId: actorId(actor) ?? '',
      paramOffset: 2,
    })
    const rows = (await this.dataSource.query(
      `SELECT 1
         FROM (SELECT $1::jsonb AS data, $2::uuid AS id) AS blueprint_records
        WHERE (${compiled.sql})
        LIMIT 1`,
      [data, randomUUID(), ...compiled.params],
    )) as Array<{ '?column?': number }>
    if (rows.length === 0) {
      throw new RecordWriteError('无权在该范围内创建记录', 'data-scope-denied', undefined, undefined, 403)
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

    const dataScope = await this.resolveBlueprintDataScope(
      blueprintId,
      entity,
      organizationId,
      actor,
      'list',
    )
    if (dataScope) {
      if (dataScope.expr.op === 'none') {
        clauses.push('1=0')
      } else if (dataScope.expr.op !== 'all') {
        const compiled = compileScopeExpr(dataScope.expr, {
          alias: 'blueprint_records',
          rowAlias: 'blueprint_records',
          organizationId,
          actorId: actorId(actor) ?? '',
          paramOffset: next,
        })
        clauses.push(compiled.sql)
        params.push(...compiled.params)
        next += compiled.params.length
      }
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
    try {
      await applyQueryIndexes(this.dataSource, blueprintId, semantic, version)
    } catch (error) {
      throw new RecordWriteError(
        `创建查询索引失败：${(error as Error).message}`,
        'query-index-failed',
      )
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
    // 正常路径：loadOrThrow 已把 CompiledTemplate 放进 BlueprintService 缓存。
    // fallback 只服务未先 load 的后台任务（例如 listAutoSuggestTargets）。
    const compiled = this.blueprints.compiledTemplate?.(packageId)
    if (compiled) return compiled as unknown as LoadedTemplate

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
