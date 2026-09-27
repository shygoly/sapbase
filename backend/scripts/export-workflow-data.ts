/**
 * 导出旧工作流四张表（只读）：定义 / 实例 / 历史 / 自动建议日志。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/export-workflow-data.ts [--out=<dir>] [--db=<name>]
 *
 * 默认：`--out=./workflow-export-<时间戳>`，`--db` 取 `DB_NAME`（否则 sapbasic）。
 * 只导出、不删行、不改表。同一 `--out` 重复跑覆盖同名文件。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const TABLES = [
  'workflow_definitions',
  'workflow_instances',
  'workflow_history',
  'workflow_auto_suggestion_logs',
] as const

interface ExportOptions {
  out: string
  db: string
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

export function parseExportArgs(argv: string[]): ExportOptions {
  let out: string | undefined
  let db: string | undefined
  for (const arg of argv) {
    if (arg.startsWith('--out=')) out = arg.slice('--out='.length)
    if (arg.startsWith('--db=')) db = arg.slice('--db='.length)
  }
  return {
    out: out && out.length > 0 ? out : `./workflow-export-${stamp()}`,
    db: db && db.length > 0 ? db : process.env.DB_NAME || 'sapbasic',
  }
}

export async function exportWorkflowData(options: ExportOptions): Promise<Record<(typeof TABLES)[number], number>> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'mac',
    password: process.env.DB_PASSWORD || '',
    database: options.db,
  })
  await client.connect()
  try {
    mkdirSync(options.out, { recursive: true })
    const counts = {
      workflow_definitions: 0,
      workflow_instances: 0,
      workflow_history: 0,
      workflow_auto_suggestion_logs: 0,
    }
    for (const table of TABLES) {
      const result = await client.query(`SELECT * FROM public.${table} ORDER BY id ASC`)
      counts[table] = result.rowCount ?? result.rows.length
      writeFileSync(join(options.out, `${table}.json`), `${JSON.stringify(result.rows, null, 2)}\n`)
    }
    writeFileSync(join(options.out, 'counts.json'), `${JSON.stringify(counts, null, 2)}\n`)
    return counts
  } finally {
    await client.end()
  }
}

function printCounts(counts: Record<(typeof TABLES)[number], number>, out: string): void {
  console.log('workflow export counts')
  for (const table of TABLES) {
    console.log(`  ${table}: ${counts[table]}`)
  }
  console.log(`exported to ${out}`)
}

async function main(): Promise<void> {
  const options = parseExportArgs(process.argv.slice(2))
  const counts = await exportWorkflowData(options)
  printCounts(counts, options.out)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
