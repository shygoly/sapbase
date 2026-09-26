/**
 * 端到端：非空 CHECK 与唯一索引都拦得住直连 INSERT；错误可定位到 entity/field。
 */
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import {
  applyNotNullConstraints,
  notNullConstraintDdl,
  notNullConstraintName,
} from '../src/semantic-runtime/db-constraints'
import { uniqueIndexDdl, uniqueIndexName } from '../src/semantic-runtime/unique-index'
import { mapConstraintError } from '../src/semantic-runtime/record-write-error'
import { constraintFieldMap } from '../src/semantic-runtime/db-constraints'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'

const BLUEPRINT_ID = 'p2-nn-proof'
const ORGANIZATION_ID = '99999999-9999-9999-9999-999999999999'
const NN_NAME = notNullConstraintName(BLUEPRINT_ID, 'Part', 'partNo')
const UX_NAME = uniqueIndexName(BLUEPRINT_ID, 'Part', 'partNo')

const SEMANTIC = {
  entities: [
    {
      name: 'Part',
      fields: [
        { name: 'partNo', type: 'text', unique: true, required: true },
        { name: 'name', type: 'text' },
      ],
    },
  ],
}

describe('非空 + 唯一约束拦直连 INSERT（e2e）', () => {
  let db: DataSource
  let available = true

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
      for (const statement of BLUEPRINT_RECORDS_DDL) await db.query(statement)
    } catch {
      available = false
      console.warn('跳过 e2e：本地库缺少 blueprint_records 或 organizations')
      return
    }
    await db.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'p2-nn-proof', 'p2-nn-proof', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )
    // 与 unique-index-db 同理：上一次装载留下的 nn_br_* 会提前挡住「先插空值再报清单」。
    const leftover = (await db.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.blueprint_records'::regclass AND conname LIKE 'nn_br_%'`,
    )) as Array<{ conname: string }>
    for (const row of leftover) {
      await db.query(`ALTER TABLE public.blueprint_records DROP CONSTRAINT IF EXISTS ${row.conname}`)
    }
  }, 30000)

  afterAll(async () => {
    if (db?.isInitialized && available) {
      await db.query(`ALTER TABLE public.blueprint_records DROP CONSTRAINT IF EXISTS ${NN_NAME}`)
      await db.query(`DROP INDEX IF EXISTS public.${UX_NAME}`)
      await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
      await db.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID]).catch(() => undefined)
    }
    await db?.destroy()
  }, 30000)

  it('先报空值清单；建 CHECK 后缺 partNo 被 23514 拒，并可定位到 Part.partNo', async () => {
    if (!available) return
    await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
    await insertPart(db, null)

    const conflicts = await applyNotNullConstraints(db, BLUEPRINT_ID, SEMANTIC)
    expect(conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Part', field: 'partNo' })]),
    )

    await db.query(`DELETE FROM public.blueprint_records WHERE "blueprintId" = $1`, [BLUEPRINT_ID])
    for (const ddl of notNullConstraintDdl(SEMANTIC, BLUEPRINT_ID)) {
      await db.query(ddl)
    }
    for (const ddl of uniqueIndexDdl(SEMANTIC, BLUEPRINT_ID)) {
      await db.query(ddl)
    }

    try {
      await insertPart(db, null)
      throw new Error('本应被非空 CHECK 拒')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('23514')
      const mapped = mapConstraintError(error, constraintFieldMap(BLUEPRINT_ID, SEMANTIC))
      expect(mapped?.reason).toBe('not-null-violation')
      expect(mapped?.entity).toBe('Part')
      expect(mapped?.field).toBe('partNo')
      expect(mapped?.message).toMatch(/Part\.partNo/)
    }

    const partNo = `P2-${Date.now()}`
    await insertPart(db, partNo)
    try {
      await insertPart(db, partNo)
      throw new Error('本应被唯一索引拒')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('23505')
      const mapped = mapConstraintError(error, constraintFieldMap(BLUEPRINT_ID, SEMANTIC))
      expect(mapped?.reason).toBe('unique-violation')
      expect(mapped?.entity).toBe('Part')
      expect(mapped?.field).toBe('partNo')
    }
  }, 30000)
})

async function insertPart(db: DataSource, partNo: string | null): Promise<void> {
  const data = partNo === null ? { name: '垫片' } : { partNo, name: '垫片' }
  await db.query(
    `INSERT INTO public.blueprint_records
      (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data)
     VALUES ($1, now(), now(), $2, $3, '1.0.0', 'Part', $4::jsonb)`,
    [randomUUID(), ORGANIZATION_ID, BLUEPRINT_ID, JSON.stringify(data)],
  )
}
