/**
 * 「从零重建」验证器：在空库上跑完全部迁移，然后**比对实体与库是否零差异**。
 *
 * 为什么用"实体 vs 库的差异"而不是数表：数表只能证明"有 30 张表"，
 * 证明不了"每张表的列/类型/约束都对"。TypeORM 的 schema 差异计算正好回答后者 ——
 * 差异为空才算真正重建成功（元语不变量：判定权在平台，不靠人肉核对）。
 *
 * 安全：只在以 `sapbase_rebuild` / `sapbase_gen` 开头的临时库上工作。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/verify-from-zero.ts --db=sapbase_rebuild
 */
import { join } from 'node:path'
import { DataSource } from 'typeorm'
import { rebuildDatabase } from './rebuild-database'

const ALLOWED_PREFIXES = ['sapbase_rebuild', 'sapbase_gen']

async function main(): Promise<void> {
  const db = process.argv.find((value) => value.startsWith('--db='))?.slice('--db='.length)
  if (!db || !ALLOWED_PREFIXES.some((prefix) => db.startsWith(prefix))) {
    throw new Error(`必须指定 --db=<临时库名>（只允许 ${ALLOWED_PREFIXES.join(' / ')} 开头）`)
  }

  const host = process.env.DB_HOST || 'localhost'
  const port = parseInt(process.env.DB_PORT || '5432', 10)
  const username = process.env.DB_USERNAME || 'mac'
  const password = process.env.DB_PASSWORD || ''

  const rebuilt = await rebuildDatabase({ database: db, host, port, username, password })
  console.log(
    `空库已重建：${rebuilt.tables.length} 张表；台账 ${rebuilt.ledgerEntries.length} 条` +
      '（基线 + 被吸收的历史迁移）',
  )

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database: db,
    entities: [join(__dirname, '../src/**/*.entity.ts')],
    migrations: [],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: false,
  })
  await dataSource.initialize()

  const tables = (await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations' ORDER BY tablename`,
  )) as Array<{ tablename: string }>
  const entityTables = dataSource.entityMetadatas
    .map((meta) => meta.tableName)
    .sort()
  const missing = entityTables.filter((name) => !tables.some((row) => row.tablename === name))

  // 关键判定：库与实体之间还有没有待执行的 schema 变更
  const diff = await dataSource.driver.createSchemaBuilder().log()
  const up = diff.upQueries.map((query) => query.query)
  const down = diff.downQueries.map((query) => query.query)

  console.log(`表 ${tables.length} 张（实体 ${entityTables.length} 张）`)
  if (missing.length > 0) console.error(`缺表：${missing.join(', ')}`)

  // 默认值"写法差异" vs 真正的结构差异
  //
  // Postgres 里 jsonb 列的 `DEFAULT '[]'` 与 `DEFAULT '[]'::jsonb` 是同一个默认值
  // （写进列定义时就会隐式转换），但 TypeORM 的差异比较按**文本**比对，于是这两种写法
  // 会一直被报成"待执行"。这不是结构差异，只是记号差异 —— 单独列出来，不计入失败。
  // 归类的判据很窄：两边都必须是 `ALTER COLUMN ... SET DEFAULT` 且去掉类型转换后相等。
  const normalizeDefault = (query: string) =>
    query.replace(/::(jsonb|text|character varying|integer|bigint|boolean)/g, '').trim()
  const [defaultOnly, blocking] = splitByNotationOnly(up, down, normalizeDefault)

  console.log(`实体 → 库 待执行 ${up.length} 条；库 → 实体 待执行 ${down.length} 条`)
  for (const query of blocking.slice(0, 10)) console.log(`  ✗ ${query}`)
  for (const query of defaultOnly) console.log(`  ≈ ${query}（仅默认值写法差异，非结构差异）`)

  await dataSource.destroy()
  const ok = missing.length === 0 && blocking.length === 0
  console.log(
    ok
      ? `✅ 从零重建成功：实体与库无结构差异（另有 ${defaultOnly.length} 处默认值写法差异）`
      : '❌ 从零重建不完整',
  )
  process.exit(ok ? 0 : 1)
}

/**
 * 把差异分成"仅默认值写法不同"与"真正的结构差异"。
 *
 * 只有当 `up` 与 `down` 里存在**成对**的 `SET DEFAULT` 语句、且去掉类型转换后完全相等时，
 * 才归入前者。单边出现、或不是默认值语句的，一律算结构差异。
 */
function splitByNotationOnly(
  up: string[],
  down: string[],
  normalize: (query: string) => string,
): [string[], string[]] {
  const isDefault = (query: string) => /ALTER COLUMN .* SET DEFAULT/.test(query)
  const downNormalized = new Map<string, number>()
  for (const query of down) {
    const key = normalize(query)
    downNormalized.set(key, (downNormalized.get(key) ?? 0) + 1)
  }

  const notationOnly: string[] = []
  const blocking: string[] = []
  for (const query of up) {
    const key = normalize(query)
    const available = downNormalized.get(key) ?? 0
    if (isDefault(query) && available > 0) {
      downNormalized.set(key, available - 1)
      notationOnly.push(query)
      continue
    }
    blocking.push(query)
  }
  for (const [key, count] of downNormalized) {
    for (let i = 0; i < count; i += 1) blocking.push(key)
  }
  return [notationOnly, blocking]
}

main().catch((error) => {
  console.error('验证失败：', error)
  process.exit(1)
})
