/**
 * 「从零重建」：把空库建成与**实体定义**一致的 schema。
 *
 * 两条路各自成立，终点必须一样：
 *
 *   存量库    走历史增量迁移（`npm run migration:run`），一路叠上来
 *   空库      走 **squash 基线**（本脚本）：一次建成当前 schema，
 *             并把历史迁移写进台账（它们"已被基线吸收"，不重放）
 *
 * 为什么要用脚本而不是"基线当第一个迁移"：见 `src/migrations/schema-baseline-apply.ts`
 * 的说明 —— 历史迁移里有 `ADD COLUMN` 打在基线上，而历史迁移不许改写。
 *
 * 安全：只允许在以 `sapbase_rebuild` / `sapbase_gen` 开头的库上执行（会 DROP DATABASE）。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/rebuild-database.ts --db=sapbase_rebuild
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { DataSource } from 'typeorm'
import {
  BASELINE_MIGRATION_NAME,
  applyEntitySchemaBaseline,
} from '../src/migrations/schema-baseline-apply'

const ALLOWED_PREFIXES = ['sapbase_rebuild', 'sapbase_gen']

export interface RebuildOptions {
  database: string
  host?: string
  port?: number
  username?: string
  password?: string
}

export interface RebuildResult {
  database: string
  tables: string[]
  ledgerEntries: string[]
  statementCount: number
}

/**
 * 历史迁移的 `(timestamp, name)` —— 从**文件名与导出类名**读出来，不手抄一份清单。
 *
 * 手抄的清单一定会漂移（`data-source.ts` 里那份就是漏的），从源码读则不会。
 */
function legacyMigrations(): Array<{ timestamp: string; name: string }> {
  const dir = join(__dirname, '../src/migrations')
  const out: Array<{ timestamp: string; name: string }> = []
  for (const file of readdirSync(dir)) {
    const match = file.match(/^(\d{13})-([\w-]+)\.ts$/)
    if (!match) continue
    const source = readFileSync(join(dir, file), 'utf8')
    const classMatch = source.match(/export class (\w+)\s+implements MigrationInterface/)
    if (!classMatch) continue
    out.push({ timestamp: match[1], name: classMatch[1] })
  }
  return out.sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10))
}

export async function rebuildDatabase(options: RebuildOptions): Promise<RebuildResult> {
  const host = options.host ?? process.env.DB_HOST ?? 'localhost'
  const port = options.port ?? parseInt(process.env.DB_PORT ?? '5432', 10)
  const username = options.username ?? process.env.DB_USERNAME ?? 'mac'
  const password = options.password ?? process.env.DB_PASSWORD ?? ''
  const database = options.database

  if (!ALLOWED_PREFIXES.some((prefix) => database.startsWith(prefix))) {
    throw new Error(
      `拒绝在「${database}」上重建：只允许以 ${ALLOWED_PREFIXES.join(' / ')} 开头的临时库` +
        '（重建会 DROP DATABASE）',
    )
  }

  const admin = new Client({ host, port, user: username, password, database: 'postgres' })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${database}`)
  await admin.query(`CREATE DATABASE ${database}`)
  await admin.end()

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: [],
    migrations: [],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: false,
  })
  await dataSource.initialize()
  const queryRunner = dataSource.createQueryRunner()

  await applyEntitySchemaBaseline(queryRunner)

  // 迁移台账：TypeORM 只在"跑迁移"时才建这张表，这里手动建（列定义与 TypeORM 默认一致）
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL NOT NULL,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL,
      CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
    )
  `)

  // 迁移台账：基线自己 + 被它吸收的历史迁移
  const legacy = legacyMigrations()
  const baselineTimestamp = BASELINE_MIGRATION_NAME.match(/(\d{13})$/)?.[1] ?? '0'
  await queryRunner.query(
    `INSERT INTO migrations ("timestamp", "name") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [baselineTimestamp, BASELINE_MIGRATION_NAME],
  )
  for (const migration of legacy) {
    await queryRunner.query(
      `INSERT INTO migrations ("timestamp", "name") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [migration.timestamp, migration.name],
    )
  }

  const tables = (await queryRunner.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  )) as Array<{ tablename: string }>

  const result: RebuildResult = {
    database,
    tables: tables.map((row) => row.tablename),
    ledgerEntries: [BASELINE_MIGRATION_NAME, ...legacy.map((m) => m.name)],
    statementCount: 0,
  }

  await queryRunner.release()
  await dataSource.destroy()
  return result
}

async function main(): Promise<void> {
  const database = process.argv.find((value) => value.startsWith('--db='))?.slice('--db='.length)
  if (!database) throw new Error('必须指定 --db=<临时库名>')
  const result = await rebuildDatabase({ database })
  console.log(`已重建 ${result.database}：${result.tables.length} 张表`)
  console.log(`台账 ${result.ledgerEntries.length} 条（基线 1 + 历史迁移 ${result.ledgerEntries.length - 1}）`)
}

if (process.argv[1]?.endsWith('rebuild-database.ts')) {
  main().catch((error) => {
    console.error('重建失败：', error)
    process.exit(1)
  })
}
