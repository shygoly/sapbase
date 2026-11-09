import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Client } from 'pg'
import request from 'supertest'
import { DataSource, Entity, PrimaryColumn } from 'typeorm'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { AuditLog } from '../src/audit-logs/audit-log.entity'
import { JobsModule } from '../src/jobs/jobs.module'
import { ASYNC_JOB_DDL } from '../src/jobs/jobs.ddl'
import { Job, JobAttempt, JobEvent } from '../src/jobs/entities'
import { JobQueue } from '../src/jobs/job-queue'
import { JobTypeRegistry } from '../src/jobs/job-types'

const RUN = process.env.RUN_ASYNC_JOB_E2E === '1'
const describeDb = RUN ? describe : describe.skip

@Entity('organizations')
class Organization {
  @PrimaryColumn('uuid')
  id: string
}

/**
 * 任务 HTTP API 的真实 Postgres e2e：创建/幂等/查询/列表/取消/重试/事件/权限。
 *
 *   RUN_ASYNC_JOB_E2E=1 npx jest --config test/jest-e2e.json test/jobs-http.e2e-spec.ts --runInBand
 */
describeDb('Jobs HTTP API (real Postgres)', () => {
  const suffix = `${Date.now()}_${process.pid}`
  const dbName = `sapbase_jobs_http_${suffix}`
  const orgId = '88888888-8888-4888-8888-888888888888'

  let root: Client
  let app: INestApplication
  let dataSource: DataSource
  let queue: JobQueue
  let currentUser: {
    id: string
    userId: string
    organizationId: string
    permissions: string[]
  }

  beforeAll(async () => {
    root = new Client({ database: 'postgres' })
    await root.connect()
    await root.query(`CREATE DATABASE "${dbName}"`)

    const setup = new Client({ database: dbName })
    await setup.connect()
    try {
      await setup.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      await setup.query('CREATE TABLE public.organizations (id uuid PRIMARY KEY)')
      await setup.query(`CREATE TABLE public.audit_logs (
        id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "organizationId" uuid NOT NULL,
        action character varying NOT NULL,
        resource character varying NOT NULL,
        actor character varying NOT NULL,
        status character varying(50) NOT NULL,
        "resourceId" uuid,
        changes jsonb,
        metadata jsonb,
        timestamp timestamp DEFAULT now() NOT NULL
      )`)
      for (const statement of ASYNC_JOB_DDL) await setup.query(statement)
      await setup.query('INSERT INTO public.organizations (id) VALUES ($1)', [orgId])
    } finally {
      await setup.end()
    }

    currentUser = {
      id: '99999999-9999-4999-8999-999999999999',
      userId: '99999999-9999-4999-8999-999999999999',
      organizationId: orgId,
      permissions: ['job:test.echo:create', 'jobs:read', 'jobs:manage'],
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'mac',
          password: process.env.DB_PASSWORD || '',
          database: dbName,
          entities: [Organization, AuditLog, Job, JobAttempt, JobEvent],
          synchronize: false,
        }),
        JobsModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: unknown; organizationId?: string }
          }
        }) => {
          const req = context.switchToHttp().getRequest()
          req.user = { ...currentUser }
          req.organizationId = currentUser.organizationId
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)
    queue = moduleRef.get(JobQueue)
    moduleRef.get(JobTypeRegistry).register({
      type: 'test.echo',
      payloadSchema: {
        type: 'object',
        required: ['value'],
        properties: { value: { type: 'number' } },
        additionalProperties: false,
      },
      handler: async (_ctx, payload) => ({ result: payload }),
      timeoutMs: 5_000,
      maxAttempts: 2,
    })
  }, 30000)

  afterAll(async () => {
    await app?.close().catch(() => undefined)
    await dataSource?.destroy().catch(() => undefined)
    await root
      ?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => undefined)
    await root?.end().catch(() => undefined)
  }, 30000)

  const server = () => app.getHttpServer()

  let jobId = ''

  it('缺少任务类型创建权限 → 403', async () => {
    currentUser = { ...currentUser, permissions: ['jobs:read'] }
    const response = await request(server()).post('/jobs').send({
      type: 'test.echo',
      payload: { value: 1 },
    })
    expect(response.status).toBe(403)
    currentUser = {
      ...currentUser,
      permissions: ['job:test.echo:create', 'jobs:read', 'jobs:manage'],
    }
  })

  it('创建任务 + 幂等键返回同一任务', async () => {
    const first = await request(server()).post('/jobs').send({
      type: 'test.echo',
      payload: { value: 1 },
      idempotencyKey: 'http-idem-1',
    })
    expect(first.status).toBe(201)
    jobId = first.body.job.id
    expect(first.body).toMatchObject({
      created: true,
      job: { type: 'test.echo', status: 'queued', organizationId: orgId },
    })

    const second = await request(server()).post('/jobs').send({
      type: 'test.echo',
      payload: { value: 2 },
      idempotencyKey: 'http-idem-1',
    })
    expect(second.status).toBe(201)
    expect(second.body.created).toBe(false)
    expect(second.body.job.id).toBe(jobId)
    expect(second.body.job.payload).toEqual({ value: 1 })
  })

  it('非法 payload → 400；私网回调 → 400', async () => {
    await request(server())
      .post('/jobs')
      .send({ type: 'test.echo', payload: { value: 'not-number' } })
      .expect(400)
    await request(server())
      .post('/jobs')
      .send({
        type: 'test.echo',
        payload: { value: 1 },
        callbackUrl: 'https://127.0.0.1/cb',
      })
      .expect(400)
  })

  it('查询状态/列表', async () => {
    const one = await request(server()).get(`/jobs/${jobId}`)
    expect(one.status).toBe(200)
    expect(one.body).toMatchObject({ id: jobId, status: 'queued' })

    const list = await request(server()).get('/jobs?status=queued')
    expect(list.status).toBe(200)
    expect(list.body.total).toBeGreaterThanOrEqual(1)
    expect(list.body.items.map((row: { id: string }) => row.id)).toContain(jobId)

    const missing = await request(server()).get(
      '/jobs/00000000-0000-4000-8000-000000000000',
    )
    expect(missing.status).toBe(404)
  })

  it('取消 queued 任务 → cancelled', async () => {
    const response = await request(server()).post(`/jobs/${jobId}/cancel`).send({})
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ id: jobId, status: 'cancelled' })
  })

  it('事件 afterSeq 回放', async () => {
    await queue.appendEvent(jobId, 'stage', { stage: 'phase-1' })
    await queue.appendEvent(jobId, 'log', { message: 'hello' })
    const response = await request(server()).get(`/jobs/${jobId}/events?afterSeq=0`)
    expect(response.status).toBe(200)
    expect(response.body.map((event: { seq: number }) => event.seq)).toEqual([1, 2])
    const after = await request(server()).get(`/jobs/${jobId}/events?afterSeq=1`)
    expect(after.body.map((event: { seq: number }) => event.seq)).toEqual([2])
  })

  it('dead 任务可手动重放为 queued', async () => {
    const { job } = await queue.enqueue({
      organizationId: orgId,
      type: 'test.echo',
      payload: { value: 9 },
      maxAttempts: 1,
    })
    await queue.claim('worker-e2e', 30_000)
    await queue.fail(job.id, 'worker-e2e', { message: 'boom' })
    const response = await request(server()).post(`/jobs/${job.id}/retry`).send({})
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ id: job.id, status: 'queued', attempts: 0 })
  })
})
