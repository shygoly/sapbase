/**
 * W0（收敛准备）：把旧工作流的四张表导出成 JSON，附行数与内容哈希。
 *
 * 为什么需要：W3 会把 `workflows` / `workflow-context` 两棵树连同它们的表一起摘除。
 * 存量数据**不许静默丢弃** —— 先导出、核对行数、留档，再谈归档或迁移。
 * 这份产出也是 W3 的"删之前已留痕"证据：`manifest.json` 里的行数与 sha256 可复核。
 *
 * 与 `rebuild-database.ts` 的约定一致：连接参数走 `DB_*` 环境变量，可用 `--db=` 覆盖。
 *
 * **只读**：本脚本只做 `SELECT`，不写库、不建表、不改数据。
 * 表缺失时**不静默跳过** —— 记进 manifest 并以退出码 1 结束（"行数可核对"必须真的可核对）。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/export-workflow-legacy.ts --db=sapbasic --out=/tmp/wf-export
 *   npx ts-node --transpile-only scripts/export-workflow-legacy.ts --db=sapbasic --table=workflow_instances
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

/**
 * 四张表 —— 注意是**四**张，不是三张：
 * `workflow_auto_suggestion_logs`（自动建议日志）在计划里被漏掉了，
 * 它同样会随树退场，所以同样要留档。
 */
export const LEGACY_WORKFLOW_TABLES = [
  'workflow_definitions',
  'workflow_instances',
  'workflow_history',
  'workflow_auto_suggestion_logs',
] as const

export type LegacyWorkflowTable = (typeof LEGACY_WORKFLOW_TABLES)[number]

export interface TableExport {
  table: string
  rows: number
  bytes: number
  sha256: string
  file: string | null
  missing: boolean
}

export interface ExportResult {
  database: string
  exportedAt: string
  outDir: string
  tables: TableExport[]
  ok: boolean
}

interface Options {
  database: string
  outDir: string
  tables: readonly string[]
  host?: string
  port?: number
  username?: string
  password?: string
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string): string | undefined => {
    const hit = argv.find((value) => value.startsWith(`--${name}=`))
    return hit?.slice(name.length + 3)
  }
  const table = flag('table')
  if (table && !LEGACY_WORKFLOW_TABLES.includes(table as LegacyWorkflowTable)) {
    throw new Error(
      `--table=${table} 不是旧工作流的表；合法值：${LEGACY_WORKFLOW_TABLES.join(' / ')}`,
    )
  }
  const port = flag('port')
  return {
    database: flag('db') ?? process.env.DB_NAME ?? 'sapbasic',
    outDir: flag('out') ?? join(process.cwd(), 'workflow-legacy-export'),
    tables: table ? [table] : LEGACY_WORKFLOW_TABLES,
    host: flag('host') ?? process.env.DB_HOST,
    port: port ? parseInt(port, 10) : undefined,
    username: flag('user') ?? process.env.DB_USERNAME,
    password: flag('password') ?? process.env.DB_PASSWORD,
  }
}

export async function exportLegacyWorkflows(options: Options): Promise<ExportResult> {
  const client = new Client({
    host: options.host ?? 'localhost',
    port: options.port ?? parseInt(process.env.DB_PORT ?? '5432', 10),
    user: options.username ?? 'mac',
    password: options.password ?? '',
    database: options.database,
  })

  mkdirSync(options.outDir, { recursive: true })
  await client.connect()

  const tables: TableExport[] = []
  try {
    for (const table of options.tables) {
      // 只认标识符白名单，再交给 to_regclass 判断存在性（不做字符串拼 SQL）
      const exists = await client.query<{ oid: string | null }>(
        'SELECT to_regclass($1)::text AS oid',
        [`public.${table}`],
      )
      if (!exists.rows[0]?.oid) {
        tables.push({ table, rows: 0, bytes: 0, sha256: '', file: null, missing: true })
        continue
      }

      const result = await client.query(`SELECT * FROM ${quoteIdent(table)} ORDER BY 1`)
      const payload = JSON.stringify(
        { table, database: options.database, rows: result.rowCount, data: result.rows },
        null,
        2,
      )
      const file = join(options.outDir, `${table}.json`)
      writeFileSync(file, payload)
      tables.push({
        table,
        rows: result.rowCount ?? result.rows.length,
        bytes: Buffer.byteLength(payload),
        sha256: createHash('sha256').update(payload).digest('hex'),
        file,
        missing: false,
      })
    }
  } finally {
    await client.end()
  }

  const result: ExportResult = {
    database: options.database,
    exportedAt: new Date().toISOString(),
    outDir: options.outDir,
    tables,
    ok: tables.every((entry) => !entry.missing),
  }
  writeFileSync(join(options.outDir, 'manifest.json'), JSON.stringify(result, null, 2))
  return result
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`非法表名：${name}`)
  return `"public"."${name}"`
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const result = await exportLegacyWorkflows(options)

  console.log(`库：${result.database}    输出：${result.outDir}`)
  for (const entry of result.tables) {
    if (entry.missing) {
      console.log(`  ${entry.table.padEnd(32)} 表不存在 —— 未导出`)
    } else {
      console.log(
        `  ${entry.table.padEnd(32)} ${String(entry.rows).padStart(6)} 行  sha256=${entry.sha256.slice(0, 12)}…`,
      )
    }
  }

  if (!result.ok) {
    console.error('\n有表不存在：不做"看起来成功"的导出。请确认库名/迁移状态后重跑。')
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
