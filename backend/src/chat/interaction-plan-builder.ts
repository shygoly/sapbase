/**
 * 工具结果 → Interaction Plan。判定只走 validateInteractionPlan（元语不变量 12）。
 * 生成不合法是实现 bug：抛错，不把非法 plan 交给渲染器。
 */
import type { ToolCatalog } from '../agent-tools/contracts-loader'
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import { validateInteractionPlan } from './chat-protocol-validator'
import type {
  CellValue,
  FactValue,
  InteractionPlan,
  PlanAction,
  PlanBlock,
} from './chat.types'

export const SURFACE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const MAX_TABLE_COLUMNS = 12
const MAX_TABLE_ROWS = 200

const CANCEL: PlanAction = { kind: 'cancel', id: 'cancel', label: '算了' }

export function surfaceFromToolName(toolName: string): string {
  const surface = toolName.replace(/^erp_/, '').replace(/_/g, '-')
  if (!SURFACE_PATTERN.test(surface)) {
    throw new Error(`工具名 ${toolName} 无法导出合法 surface（得到 ${surface}）`)
  }
  return surface
}

export function titleForTool(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'erp_blueprint_list':
      return '已登记的蓝图包'
    case 'erp_blueprint_manifest':
      return `蓝图包 ${String(args.id)} 的清单`
    case 'erp_blueprint_compile':
      return `编译蓝图包 ${String(args.id)}`
    case 'erp_atomic_invoke':
      return `运行原子 ${String(args.atomicType)}`
    case 'erp_module_list':
      return '当前组织的模块'
    case 'erp_module_export':
      return `把模块 ${String(args.id)} 导出为最小蓝图包`
    default:
      throw new Error(`未知工具 ${toolName}，无法生成标题`)
  }
}

function asFactValue(value: unknown): FactValue | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value === null) return 'null'
  return JSON.stringify(value)
}

function asCellValue(value: unknown): CellValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return JSON.stringify(value)
}

function factsFromObject(source: string, record: Record<string, unknown>): PlanBlock {
  const items: Array<{ label: string; value: FactValue; source: string }> = []
  for (const [label, raw] of Object.entries(record)) {
    const value = asFactValue(raw)
    if (value === undefined) continue
    items.push({ label, value, source })
  }
  if (items.length === 0) {
    items.push({ label: '结果', value: '（无可展示的标量字段）', source })
  }
  return { kind: 'facts', items: items.slice(0, 50) }
}

function emptyFacts(source: string, message: string): PlanBlock {
  return { kind: 'facts', items: [{ label: '结果', value: message, source }] }
}

function tableFromColumnsAndRows(
  columns: string[],
  rows: unknown[],
): { table: PlanBlock; anomaly?: PlanBlock } {
  const truncatedCols = columns.length > MAX_TABLE_COLUMNS
  const truncatedRows = rows.length > MAX_TABLE_ROWS
  const shownColumns = columns.slice(0, MAX_TABLE_COLUMNS)
  const shownRows = rows.slice(0, MAX_TABLE_ROWS).map((row) => {
    if (Array.isArray(row)) {
      return shownColumns.map((_, index) => asCellValue(row[index]))
    }
    if (row && typeof row === 'object') {
      const record = row as Record<string, unknown>
      return shownColumns.map((column) => asCellValue(record[column]))
    }
    return shownColumns.map((_, index) => (index === 0 ? asCellValue(row) : null))
  })
  const table: PlanBlock = { kind: 'table', columns: shownColumns, rows: shownRows }
  if (!truncatedCols && !truncatedRows) return { table }
  return {
    table,
    anomaly: {
      kind: 'anomaly',
      severity: 'info',
      message: `结果已截断：原有 ${columns.length} 列 / ${rows.length} 行，展示前 ${MAX_TABLE_COLUMNS} 列 / ${MAX_TABLE_ROWS} 行`,
    },
  }
}

function tableFromRecords(
  records: Array<Record<string, unknown>>,
  columns: string[],
): PlanBlock {
  return tableFromColumnsAndRows(columns, records).table
}

function versionOf(record: Record<string, unknown>): CellValue {
  const manifest = record.manifest
  if (manifest && typeof manifest === 'object') {
    return asCellValue((manifest as { version?: unknown }).version)
  }
  return asCellValue(record.version)
}

function mapReadBlocks(toolName: string, result: unknown): PlanBlock[] {
  switch (toolName) {
    case 'erp_blueprint_list': {
      if (!Array.isArray(result)) {
        throw new Error('erp_blueprint_list 的结果必须是数组')
      }
      if (result.length === 0) {
        return [emptyFacts(toolName, '没有已登记的蓝图包')]
      }
      const rows = result.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>
        return {
          id: record.id,
          file: record.file,
          版本: versionOf(record),
        }
      })
      return [tableFromRecords(rows, ['id', 'file', '版本'])]
    }
    case 'erp_blueprint_manifest':
    case 'erp_blueprint_compile': {
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error(`${toolName} 的结果必须是对象`)
      }
      return [factsFromObject(toolName, result as Record<string, unknown>)]
    }
    case 'erp_atomic_invoke':
      return mapAtomicBlocks(toolName, result)
    case 'erp_module_list': {
      if (!Array.isArray(result)) {
        throw new Error('erp_module_list 的结果必须是数组')
      }
      if (result.length === 0) {
        return [emptyFacts(toolName, '没有已登记的模块')]
      }
      return [
        tableFromRecords(
          result.map((item) => (item ?? {}) as Record<string, unknown>),
          ['id', 'name', 'version', 'status', 'moduleType'],
        ),
      ]
    }
    default:
      throw new Error(`未知工具 ${toolName}，无法映射 blocks`)
  }
}

function mapAtomicBlocks(toolName: string, result: unknown): PlanBlock[] {
  if (!result || typeof result !== 'object') {
    throw new Error('erp_atomic_invoke 的结果必须是对象')
  }
  const record = result as Record<string, unknown>
  const rawColumns = record.columns
  const rawRows = record.rows

  if (Array.isArray(rawColumns) && rawColumns.every((column) => typeof column === 'string')) {
    if (rawColumns.length === 0) {
      return [emptyFacts(toolName, '原子没有返回可展示的列')]
    }
    const rows = Array.isArray(rawRows) ? rawRows : []
    const mapped = tableFromColumnsAndRows(rawColumns, rows)
    return mapped.anomaly ? [mapped.table, mapped.anomaly] : [mapped.table]
  }

  if (rawColumns && typeof rawColumns === 'object' && !Array.isArray(rawColumns)) {
    const columns = Object.keys(rawColumns as Record<string, unknown>)
    if (columns.length === 0) {
      return [emptyFacts(toolName, '原子没有返回可展示的列')]
    }
    const values = rawColumns as Record<string, unknown>
    const width = Math.max(
      0,
      ...columns.map((column) => (Array.isArray(values[column]) ? values[column].length : 0)),
    )
    const rows = Array.from({ length: width }, (_, row) =>
      columns.map((column) => {
        const series = values[column]
        return Array.isArray(series) ? series[row] : null
      }),
    )
    const mapped = tableFromColumnsAndRows(columns, rows)
    return mapped.anomaly ? [mapped.table, mapped.anomaly] : [mapped.table]
  }

  return [factsFromObject(toolName, record)]
}

function mapWriteBlocks(toolName: string, args: Record<string, unknown>): PlanBlock[] {
  if (toolName !== 'erp_module_export') {
    throw new Error(`未知工具 ${toolName}，无法映射 blocks`)
  }
  const id = String(args.id)
  const dest =
    typeof args.out === 'string'
      ? args.out
      : typeof args.dir === 'string'
        ? args.dir
        : '最小蓝图包'
  return [
    {
      kind: 'facts',
      items: [
        { label: '将要发生', value: `将把模块 ${id} 导出到 ${dest}`, source: toolName },
        { label: '模块', value: id, source: toolName },
      ],
    },
  ]
}

export function buildInteractionPlan(input: {
  toolName: string
  args: Record<string, unknown>
  intentLabel: string
  result?: unknown
  catalog?: ToolCatalog
}): InteractionPlan {
  const catalog = input.catalog ?? loadToolCatalog()
  const tool = catalog.tools.find((item) => item.name === input.toolName)
  const known = new Set([
    'erp_blueprint_list',
    'erp_blueprint_manifest',
    'erp_blueprint_compile',
    'erp_atomic_invoke',
    'erp_module_list',
    'erp_module_export',
  ])
  if (!known.has(input.toolName)) {
    throw new Error(`未知工具 ${input.toolName}，无法映射 blocks`)
  }
  if (!tool) {
    throw new Error(`未知工具 ${input.toolName}，无法映射 blocks`)
  }

  const write = tool.confirmation === 'required'
  const blocks = write
    ? mapWriteBlocks(input.toolName, input.args)
    : mapReadBlocks(input.toolName, input.result)
  const actions: PlanAction[] = write
    ? [
        {
          kind: 'confirm',
          id: 'confirm',
          label: '确认导出',
          tool: input.toolName,
          args: input.args,
        },
        CANCEL,
      ]
    : [CANCEL]

  const plan: InteractionPlan = {
    plan: 'interaction-plan/v1',
    surface: surfaceFromToolName(input.toolName),
    title: titleForTool(input.toolName, input.args),
    blocks,
    actions,
    trace: { tools: [input.toolName], intent: input.intentLabel },
    needsConfirmation: write,
  }

  const check = validateInteractionPlan(plan)
  if (!check.valid) {
    throw new Error(`生成的 Interaction Plan 非法（实现 bug）：${check.errors.join('; ')}`)
  }
  return plan
}
