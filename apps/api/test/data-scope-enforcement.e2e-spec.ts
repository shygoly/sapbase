import { Client } from 'pg'
import { DataSource, Entity, PrimaryColumn } from 'typeorm'
import { DataScopeService } from '../src/data-scope/data-scope.service'
import { DataScopeGuard } from '../src/data-scope/data-scope.guard'
import { ScopeEvaluator } from '../src/data-scope/scope-evaluator'
import { compileScopeExpr } from '../src/data-scope/scope-sql-compiler'
import { DATA_SCOPE_DDL } from '../src/data-scope/data-scope.ddl'
import {
  DataPolicy,
  ScopeBinding,
  ScopeDimension,
  ScopeMembership,
  ScopeNode,
  ScopeVersion,
} from '../src/data-scope/entities'
import { ForbiddenException } from '@nestjs/common'

const RUN = process.env.RUN_DATA_SCOPE_RLS === '1'
const describeDb = RUN ? describe : describe.skip

/** 测试专用最小 Organization（满足 TenantAwareEntity 的字符串关系目标）。 */
@Entity('organizations')
class Organization {
  @PrimaryColumn('uuid')
  id: string
}

/**
 * 真实 Postgres 的数据范围执行 e2e：
 *   - 区域样板：大区 → 省 → 市，省经理只看到本省及下属市
 *   - 学校样板：campus 成员 + class 维度策略，校长看到校区下所有班级
 *   - 无策略 fail-closed：guard 抛 403
 *
 * 默认跳过；本地：
 *   RUN_DATA_SCOPE_RLS=1 npx jest --config test/jest-e2e.json test/data-scope-enforcement.e2e-spec.ts --runInBand
 */
describeDb('data scope enforcement (real Postgres)', () => {
  const suffix = `${Date.now()}_${process.pid}`
  const dbName = `sapbase_ds_e2e_${suffix}`
  const orgA = '11111111-1111-4111-8111-111111111111'
  const orgB = '22222222-2222-4222-8222-222222222222'

  let admin: Client
  let root: Client
  let dataSource: DataSource
  let service: DataScopeService

  beforeAll(async () => {
    root = new Client({ database: 'postgres' })
    await root.connect()
    await root.query(`CREATE DATABASE "${dbName}"`)

    admin = new Client({ database: dbName })
    await admin.connect()
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    await admin.query(
      `CREATE TABLE public.organizations (
         id uuid PRIMARY KEY
       )`,
    )
    for (const statement of DATA_SCOPE_DDL) await admin.query(statement)
    await admin.query(
      `CREATE TABLE public.crm_customers (
         id uuid PRIMARY KEY,
         "organizationId" uuid NOT NULL,
         "regionId" text,
         name text
       )`,
    )
    await admin.query(
      `CREATE TABLE public.students (
         id uuid PRIMARY KEY,
         "organizationId" uuid NOT NULL,
         "classId" text,
         name text
       )`,
    )
    await admin.query(`INSERT INTO public.organizations (id) VALUES ($1), ($2)`, [
      orgA,
      orgB,
    ])

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      entities: [
        Organization,
        ScopeDimension,
        ScopeNode,
        ScopeMembership,
        ScopeBinding,
        DataPolicy,
        ScopeVersion,
      ],
      synchronize: false,
    })
    await dataSource.initialize()
    service = new DataScopeService(
      dataSource.getRepository(ScopeDimension),
      dataSource.getRepository(ScopeNode),
      dataSource.getRepository(ScopeMembership),
      dataSource.getRepository(ScopeBinding),
      dataSource.getRepository(DataPolicy),
      dataSource.getRepository(ScopeVersion),
      new ScopeEvaluator(),
    )
  }, 30000)

  afterAll(async () => {
    await dataSource?.destroy().catch(() => undefined)
    await admin?.end().catch(() => undefined)
    await root
      ?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => undefined)
    await root?.end().catch(() => undefined)
  }, 30000)

  it('区域样板：省经理看到本省+下属市，市经理只看本市', async () => {
    const org = '33333333-3333-4333-8333-333333333333'
    await admin.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [org])
    const dimension = await service.createDimension(org, {
      key: 'region',
      name: 'Region',
    })
    const east = await service.createNode(org, {
      dimensionId: dimension.id,
      name: 'East',
    })
    const js = await service.createNode(org, {
      dimensionId: dimension.id,
      parentId: east.id,
      name: 'Jiangsu',
    })
    const nj = await service.createNode(org, {
      dimensionId: dimension.id,
      parentId: js.id,
      name: 'Nanjing',
    })
    const west = await service.createNode(org, {
      dimensionId: dimension.id,
      name: 'West',
    })

    await service.createBinding(org, {
      resourceKey: 'platform:crm_customers',
      dimensionKey: 'region',
      kind: 'field',
      field: 'regionId',
    })
    await service.createMembership(org, {
      subjectType: 'user',
      subjectId: 'province-manager',
      nodeId: js.id,
      positionKey: 'province_manager',
    })
    await service.createPolicy(org, {
      name: 'province subtree',
      subject: { kind: 'role', roleKey: 'province_manager' },
      resourceKey: 'platform:crm_customers',
      actions: ['read', 'list'],
      scope: {
        kind: 'node',
        dimension: 'region',
        anchor: 'membership',
        positions: ['province_manager'],
        depth: 'subtree',
      },
    })

    await admin.query(
      `INSERT INTO public.crm_customers (id, "organizationId", "regionId", name) VALUES
         (gen_random_uuid(), $1, 'east', 'east-customer'),
         (gen_random_uuid(), $1, $2, 'js-customer'),
         (gen_random_uuid(), $1, $3, 'nj-customer'),
         (gen_random_uuid(), $1, $4, 'west-customer')`,
      [org, js.id, nj.id, west.id],
    )

    const resolved = await service.resolve({
      organizationId: org,
      actor: { userId: 'province-manager', roleKeys: ['province_manager'], groupKeys: [] },
      resourceKey: 'platform:crm_customers',
      action: 'read',
    })
    const compiled = compileScopeExpr(resolved.expr, {
      alias: 'c',
      organizationId: org,
      actorId: 'province-manager',
      paramOffset: 1,
    })
    const rows = await admin.query(
      `SELECT name FROM public.crm_customers c
        WHERE c."organizationId" = $1 AND (${compiled.sql})
        ORDER BY name`,
      [org, ...compiled.params],
    )
    expect(rows.rows.map((row) => row.name)).toEqual(['js-customer', 'nj-customer'])

    // 市经理（exact）：只看本市
    await service.createMembership(org, {
      subjectType: 'user',
      subjectId: 'city-manager',
      nodeId: nj.id,
      positionKey: 'city_manager',
    })
    await service.createPolicy(org, {
      name: 'city exact',
      subject: { kind: 'role', roleKey: 'city_manager' },
      resourceKey: 'platform:crm_customers',
      actions: ['read', 'list'],
      scope: {
        kind: 'node',
        dimension: 'region',
        anchor: 'membership',
        positions: ['city_manager'],
        depth: 'exact',
      },
    })
    const city = await service.resolve({
      organizationId: org,
      actor: { userId: 'city-manager', roleKeys: ['city_manager'], groupKeys: [] },
      resourceKey: 'platform:crm_customers',
      action: 'read',
    })
    const cityCompiled = compileScopeExpr(city.expr, {
      alias: 'c',
      organizationId: org,
      actorId: 'city-manager',
      paramOffset: 1,
    })
    const cityRows = await admin.query(
      `SELECT name FROM public.crm_customers c
        WHERE c."organizationId" = $1 AND (${cityCompiled.sql})`,
      [org, ...cityCompiled.params],
    )
    expect(cityRows.rows).toEqual([{ name: 'nj-customer' }])
  }, 30000)

  it('学校样板：campus→grade→class 子树，校长看全校区、班主任只看本班', async () => {
    const org = '44444444-4444-4444-8444-444444444444'
    await admin.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [org])
    const campusDim = await service.createDimension(org, { key: 'campus', name: 'Campus' })
    const campus = await service.createNode(org, {
      dimensionId: campusDim.id,
      name: 'Main Campus',
    })
    const grade = await service.createNode(org, {
      dimensionId: campusDim.id,
      parentId: campus.id,
      name: 'Grade 2',
    })
    const classA = await service.createNode(org, {
      dimensionId: campusDim.id,
      parentId: grade.id,
      name: 'Class A',
    })
    const classB = await service.createNode(org, {
      dimensionId: campusDim.id,
      parentId: grade.id,
      name: 'Class B',
    })

    await service.createBinding(org, {
      resourceKey: 'platform:students',
      dimensionKey: 'campus',
      kind: 'field',
      field: 'classId',
    })
    await service.createMembership(org, {
      subjectType: 'user',
      subjectId: 'principal',
      nodeId: campus.id,
      positionKey: 'principal',
    })
    await service.createMembership(org, {
      subjectType: 'user',
      subjectId: 'head-teacher',
      nodeId: classA.id,
      positionKey: 'head_teacher',
    })
    await service.createPolicy(org, {
      name: 'principal campus',
      subject: { kind: 'role', roleKey: 'principal' },
      resourceKey: 'platform:students',
      actions: ['read', 'list'],
      scope: {
        kind: 'node',
        dimension: 'campus',
        anchor: 'membership',
        positions: ['principal'],
        depth: 'subtree',
      },
    })
    await service.createPolicy(org, {
      name: 'head teacher exact',
      subject: { kind: 'role', roleKey: 'head_teacher' },
      resourceKey: 'platform:students',
      actions: ['read', 'list'],
      scope: {
        kind: 'node',
        dimension: 'campus',
        anchor: 'membership',
        positions: ['head_teacher'],
        depth: 'exact',
      },
    })

    await admin.query(
      `INSERT INTO public.students (id, "organizationId", "classId", name) VALUES
         (gen_random_uuid(), $1, $2, 'student-a'),
         (gen_random_uuid(), $1, $3, 'student-b')`,
      [org, classA.id, classB.id],
    )

    const resolved = await service.resolve({
      organizationId: org,
      actor: { userId: 'principal', roleKeys: ['principal'], groupKeys: [] },
      resourceKey: 'platform:students',
      action: 'read',
    })
    const compiled = compileScopeExpr(resolved.expr, {
      alias: 's',
      organizationId: org,
      actorId: 'principal',
      paramOffset: 1,
    })
    const rows = await admin.query(
      `SELECT name FROM public.students s
        WHERE s."organizationId" = $1 AND (${compiled.sql})
        ORDER BY name`,
      [org, ...compiled.params],
    )
    expect(rows.rows.map((row) => row.name)).toEqual(['student-a', 'student-b'])

    // 班主任只看本班
    const head = await service.resolve({
      organizationId: org,
      actor: { userId: 'head-teacher', roleKeys: ['head_teacher'], groupKeys: [] },
      resourceKey: 'platform:students',
      action: 'read',
    })
    const headCompiled = compileScopeExpr(head.expr, {
      alias: 's',
      organizationId: org,
      actorId: 'head-teacher',
      paramOffset: 1,
    })
    const headRows = await admin.query(
      `SELECT name FROM public.students s
        WHERE s."organizationId" = $1 AND (${headCompiled.sql})`,
      [org, ...headCompiled.params],
    )
    expect(headRows.rows).toEqual([{ name: 'student-a' }])
  }, 30000)

  it('声明了绑定但没有策略 → guard 403（fail-closed）', async () => {
    const org = '55555555-5555-4555-8555-555555555555'
    await admin.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [org])
    const dimension = await service.createDimension(org, { key: 'region', name: 'Region' })
    const node = await service.createNode(org, {
      dimensionId: dimension.id,
      name: 'Only',
    })
    await service.createBinding(org, {
      resourceKey: 'platform:orders',
      dimensionKey: 'region',
      kind: 'field',
      field: 'regionId',
    })
    const guard = new DataScopeGuard(service)
    await expect(
      guard.assertAllowed({
        organizationId: org,
        actor: { userId: 'u1', roleKeys: ['manager'], groupKeys: [] },
        resourceKey: 'platform:orders',
        action: 'read',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    void node
  }, 30000)
})
