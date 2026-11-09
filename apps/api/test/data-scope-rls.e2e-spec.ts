import { Client } from 'pg'
import { DATA_SCOPE_DDL } from '../src/data-scope/data-scope.ddl'
import { ASYNC_JOB_DDL } from '../src/jobs/jobs.ddl'
import { TENANT_RLS_DDL } from '../src/common/rls/tenant-rls.ddl'

const RUN = process.env.RUN_DATA_SCOPE_RLS === '1'
const describeDb = RUN ? describe : describe.skip

/**
 * 真实 Postgres 的 data-scope RLS 验证：
 *   - 表/策略由 DATA_SCOPE_DDL + TENANT_RLS_DDL 创建
 *   - 应用角色非 owner，RLS 必须隔离组织
 *   - 越权 INSERT 必须被 WITH CHECK 拒绝
 *
 * 默认跳过（CI 无库）；本地：
 *   RUN_DATA_SCOPE_RLS=1 npx jest --config test/jest-e2e.json test/data-scope-rls.e2e-spec.ts --runInBand
 */
describeDb('data scope RLS (real Postgres)', () => {
  const suffix = `${Date.now()}_${process.pid}`
  const dbName = `sapbase_ds_rls_${suffix}`
  const roleName = `ds_rls_${suffix}`
  const orgA = '11111111-1111-4111-8111-111111111111'
  const orgB = '22222222-2222-4222-8222-222222222222'

  let admin: Client
  let root: Client

  beforeAll(async () => {
    root = new Client({ database: 'postgres' })
    await root.connect()
    await root.query(`CREATE DATABASE "${dbName}"`)

    admin = new Client({ database: dbName })
    await admin.connect()
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    await admin.query('CREATE TABLE public.organizations (id uuid PRIMARY KEY)')
    for (const statement of DATA_SCOPE_DDL) await admin.query(statement)
    for (const statement of ASYNC_JOB_DDL) await admin.query(statement)
    for (const statement of TENANT_RLS_DDL) await admin.query(statement)

    await admin.query(`CREATE ROLE "${roleName}" NOLOGIN`)
    await admin.query(`GRANT USAGE ON SCHEMA public TO "${roleName}"`)
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`,
    )
    await admin.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "${roleName}"`)

    await admin.query(`INSERT INTO public.organizations (id) VALUES ($1), ($2)`, [orgA, orgB])
    await admin.query(
      `INSERT INTO public.scope_dimensions
         ("organizationId", key, name, status)
       VALUES ($1, 'region', 'Region A', 'active'),
              ($2, 'region', 'Region B', 'active')`,
      [orgA, orgB],
    )
  }, 30000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
    await root
      ?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => undefined)
    await root?.query(`DROP ROLE IF EXISTS "${roleName}"`).catch(() => undefined)
    await root?.end().catch(() => undefined)
  }, 30000)

  it('非 owner 角色按 app.organization_id 只看到本组织', async () => {
    await admin.query(`BEGIN`)
    try {
      await admin.query(`SET LOCAL ROLE "${roleName}"`)
      await admin.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA])
      const rows = (await admin.query('SELECT name FROM public.scope_dimensions')).rows
      expect(rows).toEqual([{ name: 'Region A' }])
    } finally {
      await admin.query(`ROLLBACK`)
    }
  })


  it('jobs 也按 app.organization_id 隔离，越权 INSERT 被拒', async () => {
    await admin.query(
      `INSERT INTO public.jobs ("organizationId", type, payload, status)
       VALUES ($1, 'test.rls', '{}'::jsonb, 'queued'),
              ($2, 'test.rls', '{}'::jsonb, 'queued')`,
      [orgA, orgB],
    )

    await admin.query(`BEGIN`)
    try {
      await admin.query(`SET LOCAL ROLE "${roleName}"`)
      await admin.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA])
      const rows = (await admin.query('SELECT "organizationId" FROM public.jobs')).rows
      expect(rows).toEqual([{ organizationId: orgA }])
      await expect(
        admin.query(
          `INSERT INTO public.jobs ("organizationId", type, payload, status)
           VALUES ($1, 'test.rls', '{}'::jsonb, 'queued')`,
          [orgB],
        ),
      ).rejects.toThrow(/row-level security|违反了行级安全策略|new row violates/i)
    } finally {
      await admin.query(`ROLLBACK`)
    }
  })

  it('越权 INSERT 被 WITH CHECK 拒绝', async () => {
    await admin.query(`BEGIN`)
    try {
      await admin.query(`SET LOCAL ROLE "${roleName}"`)
      await admin.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA])
      await expect(
        admin.query(
          `INSERT INTO public.scope_dimensions ("organizationId", key, name, status)
           VALUES ($1, 'class', 'Region B class', 'active')`,
          [orgB],
        ),
      ).rejects.toThrow(/row-level security|违反了行级安全策略|new row violates/i)
    } finally {
      await admin.query(`ROLLBACK`)
    }
  })
})
