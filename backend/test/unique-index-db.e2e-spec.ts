/**
 * 端到端：**唯一索引真的拦得住直连 INSERT**。
 *
 * 为什么这条证明必须在这里（e2e）而不是单元测试里：单元测试的 `test/setup.ts`
 * 会把 `DB_*` 指向虚构的 `test_db`，而 CI 的 apps job **没有数据库服务**
 * （见 `.github/workflows/ci.yml` 的 apps 注释与 e2e job 的 services）。
 * 一个需要真实 PostgreSQL 的断言放进单元 suite，只会在 CI 里变红。
 *
 * 判据（add-complete-autoparts-erp P0）：
 *   · 先报告冲突清单（既有重复数据），不直接建索引；
 *   · 应用生成的 DDL 后，绕过应用层直连 INSERT 第二条相同 partNo → 被 DB 拒（23505）。
 *
 * 前置：本地/CI 已有 `blueprint_records` 表（基线建出）。未满足时明确写出跳过原因。
 */
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import {
  findUniqueConflicts,
  uniqueIndexDdl,
  uniqueIndexName,
} from '../src/semantic-runtime/unique-index'

const BLUEPRINT_ID = 'p0-unique-proof'
const ORGANIZATION_ID = '55555555-5555-5555-5555-555555555555'
const INDEX_NAME = uniqueIndexName(BLUEPRINT_ID, 'Part', 'partNo')

const SEMANTIC = {
  entities: [
    {
      name: 'Part',
      fields: [
        { name: 'partNo', unique: true },
        { name: 'name' },
      ],
    },
  ],
}

describe('唯一索引拦直连 INSERT（e2e，真实 PostgreSQL）', () => {
  let db: DataSource
  let available = true
  const partNo = `P0-${Date.now()}`

  beforeAll(async () => {
    db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sapbasic',
      entities: [],
      synchronize: false,
    })
    await db.initialize()
    try {
      await db.query('SELECT 1 FROM blueprint_records LIMIT 1')
      await db.query('SELECT 1 FROM organizations LIMIT 1')
    } catch {
      available = false
      console.warn('跳过 e2e：本地库缺少 blueprint_records 或 organizations（先跑基线/迁移）')
      return
    }
    await db.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'p0-unique-proof', 'p0-unique-proof', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )
    // P1 装载时会为其它蓝图建同列唯一索引；本证明的第一步是「先插入重复再报清单」，
    // 必须在无索引状态下进行，否则 23505 会提前挡住冲突清单。
    const leftover = (await db.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'blueprint_records' AND indexname LIKE 'ux_br_%'`,
    )) as Array<{ indexname: string }>
    for (const row of leftover) {
      await db.query(`DROP INDEX IF EXISTS public.${row.indexname}`)
    }
  }, 30000)

  afterAll(async () => {
    if (db?.isInitialized && available) {
      // 证明用的索引与数据必须清干净（不留污染：这个索引不属于任何真实模板装载）
      await db.query(`DROP INDEX IF EXISTS public.${INDEX_NAME}`)
      await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [
        BLUEPRINT_ID,
      ])
      await db
        .query('DELETE FROM audit_logs WHERE "organizationId" = $1', [ORGANIZATION_ID])
        .catch(() => undefined)
      await db
        .query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID])
        .catch(() => undefined)
    }
    await db?.destroy()
  }, 30000)

  it('先报冲突清单；建索引后第二条相同 partNo 被 DB 拒（23505）', async () => {
    if (!available) return

    await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
    await insertPart(db, partNo)
    await insertPart(db, partNo)

    const conflicts = await findUniqueConflicts(db, BLUEPRINT_ID, SEMANTIC)
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'Part', field: 'partNo', value: partNo }),
      ]),
    )
    expect(conflicts[0]?.ids.length).toBeGreaterThanOrEqual(2)

    await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
    for (const ddl of uniqueIndexDdl(SEMANTIC, BLUEPRINT_ID)) {
      await db.query(ddl)
    }

    await insertPart(db, partNo)
    await expect(insertPart(db, partNo)).rejects.toMatchObject({ code: '23505' })
  }, 30000)

  it('不同租户各自用同一个 partNo → 不是冲突（唯一性按租户，与索引键一致）', async () => {
    if (!available) return

    const shared = `SHARED-${Date.now()}`
    const otherOrg = '77777777-7777-7777-7777-777777777777'
    await db.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'p0-shared-org', 'p0-shared-org', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [otherOrg],
    )
    await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
    // 上一条用例会建出唯一索引；本用例要**先有重复数据再看清单**，所以先撤掉索引。
    await db.query(`DROP INDEX IF EXISTS public.${INDEX_NAME}`)
    try {
      await insertPart(db, shared, ORGANIZATION_ID)
      await insertPart(db, shared, otherOrg)

      // 索引键是 (value, blueprintId, organizationId) —— 跨租户同名**不是**冲突，
      // 否则"两个客户各自都有 P-001"会把整个蓝图的写入全堵死。
      expect(await findUniqueConflicts(db, BLUEPRINT_ID, SEMANTIC)).toEqual([])

      // 同一租户内重复仍然是冲突
      await insertPart(db, shared, ORGANIZATION_ID)
      const conflicts = await findUniqueConflicts(db, BLUEPRINT_ID, SEMANTIC)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]?.organizationId).toBe(ORGANIZATION_ID)
    } finally {
      await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
      await db.query('DELETE FROM organizations WHERE id = $1', [otherOrg]).catch(() => undefined)
    }
  }, 30000)
})

async function insertPart(
  db: DataSource,
  value: string,
  organizationId: string = ORGANIZATION_ID,
): Promise<void> {
  await db.query(
    `INSERT INTO public.blueprint_records
      (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data)
     VALUES ($1, now(), now(), $2, $3, '1.0.0', 'Part', $4::jsonb)`,
    [randomUUID(), organizationId, BLUEPRINT_ID, JSON.stringify({ partNo: value, name: '垫片' })],
  )
}
