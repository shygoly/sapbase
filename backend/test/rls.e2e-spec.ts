import { DataSource } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { TENANT_RLS_DDL } from '../src/common/rls/tenant-rls.ddl'
import { RlsPolicyService } from '../src/common/rls/rls-policy.service'

const ORG_A = '51515151-5151-4151-8151-515151515151'
const ORG_B = '52525252-5252-4252-8252-525252525252'
const RECORD_A = '53535353-5353-4353-8353-535353535353'
const RECORD_B = '54545454-5454-4454-8454-545454545454'

describe('PostgreSQL tenant RLS', () => {
  jest.setTimeout(60000)

  let dataSource: DataSource
  let available = true
  const role = `rls_e2e_${randomUUID().replaceAll('-', '').slice(0, 12)}`

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sapbasic',
      entities: [],
      synchronize: false,
    })

    try {
      await dataSource.initialize()
      await dataSource.query('SELECT 1 FROM blueprint_records LIMIT 1')
      for (const statement of TENANT_RLS_DDL) {
        await dataSource.query(statement)
      }
      await dataSource.query(`DROP ROLE IF EXISTS "${role}"`)
      await dataSource.query(`CREATE ROLE "${role}" NOLOGIN`)
      await dataSource.query(`GRANT USAGE ON SCHEMA public TO "${role}"`)
      await dataSource.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public.blueprint_records TO "${role}"`,
      )
      await dataSource.query(
        `GRANT EXECUTE ON FUNCTION public.current_organization_id() TO "${role}"`,
      )
      await dataSource.query(
        `GRANT EXECUTE ON FUNCTION public.current_app_installation_id() TO "${role}"`,
      )
      await dataSource.query(
        `GRANT EXECUTE ON FUNCTION public.current_user_id() TO "${role}"`,
      )
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库或角色权限不可用（${(error as Error).message}）`)
      return
    }

    await cleanupRows()
    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'rls-a', 'rls-a', 'active', now(), now()),
              ($2, 'rls-b', 'rls-b', 'active', now(), now())`,
      [ORG_A, ORG_B],
    )
    await dataSource.query(
      `INSERT INTO blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, version)
       VALUES
        ($1, now(), now(), $3, 'erp', '1.0.0', 'Probe', '{"name":"A"}'::jsonb, 1),
        ($2, now(), now(), $4, 'erp', '1.0.0', 'Probe', '{"name":"B"}'::jsonb, 1)`,
      [RECORD_A, RECORD_B, ORG_A, ORG_B],
    )
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (available) {
        await cleanupRows()
        await dataSource.query(`DROP OWNED BY "${role}"`).catch(() => undefined)
        await dataSource.query(`DROP ROLE IF EXISTS "${role}"`).catch(() => undefined)
      }
      await dataSource.destroy()
    }
  })

  async function cleanupRows(): Promise<void> {
    await dataSource.query(
      `DELETE FROM blueprint_records WHERE id = ANY($1::uuid[])`,
      [[RECORD_A, RECORD_B]],
    ).catch(() => undefined)
    await dataSource.query(
      `DELETE FROM organizations WHERE id = ANY($1::uuid[])`,
      [[ORG_A, ORG_B]],
    ).catch(() => undefined)
  }

  it('非 owner 角色只能读写当前组织，跨租户写入被 RLS 拒绝', async () => {
    if (!available) return
    const runner = dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query(`SET LOCAL ROLE "${role}"`)
      await runner.query(
        `SELECT set_config('app.organization_id', $1, true),
                set_config('app.app_installation_id', '', true),
                set_config('app.user_id', $2, true)`,
        [ORG_A, '55555555-5555-4555-8555-555555555555'],
      )

      const visible = await runner.query(
        `SELECT id, "organizationId" FROM blueprint_records ORDER BY id`,
      )
      expect(visible).toEqual([{ id: RECORD_A, organizationId: ORG_A }])

      await expect(
        runner.query(
          `INSERT INTO blueprint_records
            (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, version)
           VALUES
            ('56565656-5656-4656-8656-565656565656', now(), now(), $1, 'erp', '1.0.0', 'Probe', '{}'::jsonb, 1)`,
          [ORG_B],
        ),
      ).rejects.toThrow(/row-level security|违反.*安全策略/)
    } finally {
      await runner.rollbackTransaction()
      await runner.release()
    }
  })

  it('required 模式下检测到 owner/superuser 会拒绝启动', async () => {
    if (!available) return
    const previous = process.env.RLS_ENFORCEMENT
    process.env.RLS_ENFORCEMENT = 'required'
    try {
      await expect(
        new RlsPolicyService(dataSource).onApplicationBootstrap(),
      ).rejects.toThrow(/RLS|owner|superuser|bypass/i)
    } finally {
      if (previous === undefined) delete process.env.RLS_ENFORCEMENT
      else process.env.RLS_ENFORCEMENT = previous
    }
  })
})
