/**
 * 从**实体定义**生成 schema 基线 SQL。
 *
 * 为什么需要它：仓库的迁移是按增量叠在早期库上的 —— 30 张实体表里有 15 张
 * 没有任何迁移创建（`users` / `roles` / `departments` / `ai_*` / `module_*` …），
 * 于是"从零重建数据库"这件事做不到。本脚本用 TypeORM 的 `synchronize` 在
 * **一次性的空库**上物化出实体 schema，再 `pg_dump` 成基线 SQL。
 *
 * 安全约束（写在代码里而不是靠自觉）：
 *   · 必须显式 `--to=<库名>`，且库名必须以 `sapbase_rebuild` / `sapbase_gen` 开头
 *   · 绝不 accept 现有开发库名（`sapbasic` 等）
 * 因为 `synchronize: true` 会**改表结构**，对着开发库跑一次就可能删掉别人的列。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/generate-schema-baseline.ts --to=sapbase_gen
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { DataSource } from 'typeorm'

const ALLOWED_PREFIXES = ['sapbase_rebuild', 'sapbase_gen']

/**
 * 找与**服务端同版本**的 pg_dump。
 *
 * 这台机器上装了好几个 PostgreSQL 小版本，`pg_dump` 15 导 16 的服务端会直接中止
 * （"server version mismatch"）—— 版本不匹配不是警告，是拒绝工作。
 */
function pgDumpBinary(serverVersion: string): string {
  const major = serverVersion.split('.')[0]
  const candidates = [
    `/usr/local/opt/postgresql@${major}/bin/pg_dump`,
    `/opt/homebrew/opt/postgresql@${major}/bin/pg_dump`,
    `/usr/local/Cellar/postgresql@${major}`,
  ]
  for (const candidate of candidates) {
    if (candidate.endsWith('pg_dump') && existsSync(candidate)) return candidate
  }
  return 'pg_dump'
}

async function main(): Promise<void> {
  const to = process.argv.find((value) => value.startsWith('--to='))?.slice('--to='.length)
  if (!to) throw new Error('必须显式指定 --to=<库名>（synchronize 会改表结构）')
  if (!ALLOWED_PREFIXES.some((prefix) => to.startsWith(prefix))) {
    throw new Error(
      `拒绝在「${to}」上跑 synchronize：只允许以 ${ALLOWED_PREFIXES.join(' / ')} 开头的临时库`,
    )
  }

  const host = process.env.DB_HOST || 'localhost'
  const port = parseInt(process.env.DB_PORT || '5432', 10)
  const user = process.env.DB_USERNAME || 'mac'
  const password = process.env.DB_PASSWORD || ''

  const admin = new Client({ host, port, user, password, database: 'postgres' })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${to}`)
  await admin.query(`CREATE DATABASE ${to}`)
  await admin.end()

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username: user,
    password,
    database: to,
    entities: [join(__dirname, '../src/**/*.entity.ts')],
    // 空库上物化实体 schema —— 这正是"从零重建"缺的那一半
    synchronize: true,
    logging: false,
  })
  await dataSource.initialize()
  const versionRows = (await dataSource.query('SHOW server_version')) as Array<{
    server_version: string
  }>
  const version = versionRows[0].server_version
  const tables = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  )
  await dataSource.destroy()

  const sql = execFileSync(
    pgDumpBinary(version),
    ['--schema-only', '--no-owner', '--no-privileges', '--no-comments', to],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: password } },
  )

  // ── 基线 = **全部实体表**（squash 基线）────────────────────────────
  //
  // 中途试过"只补没有迁移创建的那 15 张表，再回放历史迁移"，实测走不通：
  // 基线把 `audit_logs` 按实体建全后，历史迁移 `EnhanceAuditLogTable` 还要
  // `ADD COLUMN changes`，直接撞列；而历史迁移不许改写（backend/AGENTS.md 第 3 条）。
  // 所以采用 squash：空库一次成型，历史迁移进台账不重放（见 schema-baseline-apply.ts）。
  const migrationTables = tablesCreatedByMigrations()
  const entityTables = tables.map((row: { tablename: string }) => row.tablename)
  const baseline = entityTables

  const { immediate, deferred } = splitStatements(sql, new Set(baseline))
  writeTs('schema-baseline.ts', 'SCHEMA_BASELINE_SQL', immediate)
  writeTs('schema-baseline-deferred.ts', 'SCHEMA_BASELINE_DEFERRED_SQL', deferred)

  console.log(
    `基线表 ${baseline.length} 张（其中 ${migrationTables.size} 张历史迁移也建过 —— squash 后由基线负责）`,
  )
  console.log(
    `基线语句 ${immediate.length} 条；延后外键 ${deferred.length} 条` +
      '（指向 organizations / workflow_instances 等后续迁移才建的表）',
  )
}

/** 从迁移源码里抽出 `createTable(Table({ name: '…' }))` 建过的表名。 */
function tablesCreatedByMigrations(): Set<string> {
  const dir = join(__dirname, '../src/migrations')
  const names = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts')) continue
    const source = readFileSync(join(dir, file), 'utf8')
    for (const call of extractCalls(source, 'createTable')) {
      const match = call.match(/name:\s*'([a-z_]+)'/)
      if (match) names.add(match[1])
    }
  }
  return names
}

/** 抽出某个函数调用的完整实参文本（按括号配对，忽略字符串里的括号）。 */
function extractCalls(source: string, fn: string): string[] {
  const out: string[] = []
  const pattern = new RegExp(`${fn}\\(`, 'g')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    let depth = 1
    let index = pattern.lastIndex
    while (index < source.length && depth > 0) {
      const char = source[index]
      if (char === '(') depth += 1
      else if (char === ')') depth -= 1
      index += 1
    }
    out.push(source.slice(pattern.lastIndex, index - 1))
    pattern.lastIndex = index
  }
  return out
}

/**
 * 把 pg_dump 输出切成语句，并把**外键**分成两桶：
 *   · 指向基线内表 → 基线建立时一起建
 *   · 指向基线外的表（如 organizations）→ 必须等到那些表存在之后（另一条迁移）
 */
function splitStatements(
  dump: string,
  baseline: Set<string>,
): { immediate: string[]; deferred: string[] } {
  const immediate: string[] = ['CREATE EXTENSION IF NOT EXISTS "uuid-ossp"']
  const deferred: string[] = []

  for (const raw of dump.split(/;\s*\n/)) {
    const statement = raw
      .split('\n')
      .filter((line) => !line.startsWith('\\') && !line.startsWith('--'))
      .join('\n')
      .trim()
    if (!statement) continue
    if (/^(SET|SELECT pg_catalog\.set_config)/.test(statement)) continue
    if (/CREATE EXTENSION/.test(statement)) continue

    const table = statement.match(/^(?:CREATE TABLE|ALTER TABLE(?: ONLY)?|CREATE (?:UNIQUE )?INDEX)[^\n]*?public\.(\w+)/)
    const onTable = statement.match(/CREATE (?:UNIQUE )?INDEX[^\n]*? ON public\.(\w+)/)
    const target = onTable?.[1] ?? table?.[1]
    if (!target || !baseline.has(target)) continue

    const isForeignKey = /ADD CONSTRAINT[\s\S]*FOREIGN KEY/.test(statement)
    if (isForeignKey) {
      const references = statement.match(/REFERENCES public\.(\w+)/)
      if (references && !baseline.has(references[1])) {
        deferred.push(statement)
        continue
      }
    }
    immediate.push(statement)
  }
  return { immediate, deferred }
}

/** 生成 TS 常量模块 —— 不落 .sql 文件：`nest build` 不会把 .sql 复制进 dist。 */
function writeTs(file: string, constant: string, statements: string[]): void {
  const body = statements.map((statement) => `  \`${statement}\`,`).join('\n')
  const content =
    '// 由 scripts/generate-schema-baseline.ts 从实体定义生成，请勿手改。\n' +
    '// 重新生成：npx ts-node --transpile-only scripts/generate-schema-baseline.ts --to=sapbase_gen\n' +
    `export const ${constant}: string[] = [\n${body}\n]\n`
  writeFileSync(join(__dirname, '../src/migrations', file), content)
}

main().catch((error) => {
  console.error('生成基线失败：', error)
  process.exit(1)
})
