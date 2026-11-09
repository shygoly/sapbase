import { Client } from 'pg'
import { DataSource, Entity, PrimaryColumn } from 'typeorm'
import { ASYNC_JOB_DDL } from '../src/jobs/jobs.ddl'
import { JobQueue } from '../src/jobs/job-queue'
import { Job } from '../src/jobs/entities'
import { JobAttempt } from '../src/jobs/entities'
import { JobEvent } from '../src/jobs/entities'

const RUN = process.env.RUN_ASYNC_JOB_E2E === '1'
const describeDb = RUN ? describe : describe.skip

@Entity('organizations')
class Organization {
  @PrimaryColumn('uuid')
  id: string
}

/**
 * 任务队列的真实 Postgres e2e：入队/幂等/领取/租约/完成/失败/DLQ/取消/事件。
 *
 *   RUN_ASYNC_JOB_E2E=1 npx jest --config test/jest-e2e.json test/jobs-queue.e2e-spec.ts --runInBand
 */
describeDb('JobQueue (real Postgres)', () => {
  const suffix = `${Date.now()}_${process.pid}`
  const dbName = `sapbase_jobs_${suffix}`
  const orgId = '77777777-7777-4777-8777-777777777777'

  let root: Client
  let dataSource: DataSource
  let queue: JobQueue

  beforeAll(async () => {
    root = new Client({ database: 'postgres' })
    await root.connect()
    await root.query(`CREATE DATABASE "${dbName}"`)

    const setup = new Client({ database: dbName })
    await setup.connect()
    try {
      await setup.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      await setup.query('CREATE TABLE public.organizations (id uuid PRIMARY KEY)')
      for (const statement of ASYNC_JOB_DDL) await setup.query(statement)
      await setup.query('INSERT INTO public.organizations (id) VALUES ($1)', [orgId])
    } finally {
      await setup.end()
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      entities: [Organization, Job, JobAttempt, JobEvent],
      synchronize: false,
    })
    await dataSource.initialize()
    queue = new JobQueue(dataSource)
  }, 30000)

  afterAll(async () => {
    await dataSource?.destroy().catch(() => undefined)
    await root
      ?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => undefined)
    await root?.end().catch(() => undefined)
  }, 30000)



  it('事件保留期清理：非 dead 任务删除旧事件', async () => {
    const { job } = await queue.enqueue({
      organizationId: orgId,
      type: 'test.prune',
      payload: {},
      priority: 3000,
    })
    await queue.appendEvent(job.id, 'log', { message: 'old' })
    await dataSource.query(
      `UPDATE public.job_events SET "createdAt" = now() - interval '40 days' WHERE "jobId" = $1`,
      [job.id],
    )
    await expect(queue.pruneEvents(new Date())).resolves.toBeGreaterThanOrEqual(1)
    await expect(queue.events(orgId, job.id, 0)).resolves.toHaveLength(0)
  })

  it('事务回滚不留任务', async () => {
    await expect(
      dataSource.transaction(async (manager) => {
        await queue.enqueue(
          {
            organizationId: orgId,
            type: 'test.tx',
            payload: {},
            idempotencyKey: 'tx-rollback-1',
          },
          manager,
        )
        throw new Error('rollback-now')
      }),
    ).rejects.toThrow('rollback-now')
    const rows = await dataSource.query(
      `SELECT id FROM public.jobs WHERE "idempotencyKey" = 'tx-rollback-1'`,
    )
    expect(rows).toHaveLength(0)
  })

  it('并发领取同一任务只有一个成功（SKIP LOCKED）', async () => {
    await dataSource.query(`UPDATE public.jobs SET status = 'cancelled' WHERE status = 'queued'`)
    await queue.enqueue({
      organizationId: orgId,
      type: 'test.concurrent',
      payload: {},
      priority: 2000,
    })
    const [first, second] = await Promise.all([
      queue.claim('worker-a', 30_000),
      queue.claim('worker-b', 30_000),
    ])
    const claimed = [first, second].filter(Boolean)
    expect(claimed).toHaveLength(1)
  })

  it('入队 + 幂等键返回同一任务', async () => {
    const first = await queue.enqueue({
      organizationId: orgId,
      type: 'test.echo',
      payload: { value: 1 },
      idempotencyKey: 'idem-1',
    })
    expect(first.created).toBe(true)
    expect(first.job).toMatchObject({ status: 'queued', attempts: 0, type: 'test.echo' })

    const second = await queue.enqueue({
      organizationId: orgId,
      type: 'test.echo',
      payload: { value: 2 },
      idempotencyKey: 'idem-1',
    })
    expect(second.created).toBe(false)
    expect(second.job.id).toBe(first.job.id)
    expect(second.job.payload).toEqual({ value: 1 })
  })

  it('领取 → heartbeat → 事件 → 完成', async () => {
    const { job } = await queue.enqueue({
      organizationId: orgId,
      type: 'test.echo',
      payload: { value: 1 },
      priority: 100,
    })
    const claimed = await queue.claim('worker-1', 30_000)
    expect(claimed).toMatchObject({ id: job.id, status: 'running', workerId: 'worker-1' })
    expect(claimed?.attempts).toBe(1)

    await expect(queue.heartbeat(job.id, 'worker-1', 30_000)).resolves.toBe(true)
    await queue.progress(job.id, 42)
    await queue.appendEvent(job.id, 'progress', { progress: 42 })
    await queue.appendEvent(job.id, 'stage', { stage: 'half' })

    const events = await queue.events(orgId, job.id, 0)
    expect(events.map((event) => (event as { seq: number }).seq)).toEqual([1, 2])
    expect(events[0]).toMatchObject({ type: 'progress', payload: { progress: 42 } })

    const done = await queue.complete(job.id, 'worker-1', { echoed: true })
    expect(done).toMatchObject({ status: 'succeeded', progress: 100 })
    expect(done?.result).toEqual({ echoed: true })
  })

  it('失败 → dead → 手动重放 → queued', async () => {
    const { job } = await queue.enqueue({
      organizationId: orgId,
      type: 'test.fail',
      payload: {},
      maxAttempts: 1,
      priority: 100,
    })
    await queue.claim('worker-2', 30_000)
    const dead = await queue.fail(job.id, 'worker-2', { message: 'boom' })
    expect(dead).toMatchObject({ status: 'dead' })
    expect(dead?.error).toEqual({ message: 'boom' })

    const retried = await queue.retryDead(orgId, job.id)
    expect(retried).toMatchObject({ status: 'queued', attempts: 0, error: null })
  })

  it('queued 取消立即生效；running 只标记 cancelRequested', async () => {
    const queued = await queue.enqueue({
      organizationId: orgId,
      type: 'test.cancel',
      payload: {},
    })
    const cancelled = await queue.cancel(orgId, queued.job.id)
    expect(cancelled).toMatchObject({
      cancelledImmediately: true,
      job: expect.objectContaining({ status: 'cancelled' }),
    })

    const running = await queue.enqueue({
      organizationId: orgId,
      type: 'test.cancel',
      payload: {},
      priority: 1000,
    })
    await queue.claim('worker-3', 30_000)
    const requested = await queue.cancel(orgId, running.job.id)
    expect(requested).toMatchObject({
      cancelledImmediately: false,
      job: expect.objectContaining({ status: 'running', cancelRequested: true }),
    })
  })

  it('lease 过期 → 回收为 queued，再次领取 attempts+1', async () => {
    const { job } = await queue.enqueue({
      organizationId: orgId,
      type: 'test.lease',
      payload: {},
      priority: 1000,
    })
    await queue.claim('worker-4', 30_000)
    await dataSource.query(
      `UPDATE public.jobs SET "leaseUntil" = now() - interval '1 second' WHERE id = $1`,
      [job.id],
    )
    await expect(queue.reclaimExpired()).resolves.toContain(job.id)
    const reclaimed = await dataSource.query(`SELECT status FROM public.jobs WHERE id = $1`, [
      job.id,
    ])
    expect(reclaimed[0].status).toBe('queued')

    const claimedAgain = await queue.claim('worker-5', 30_000)
    expect(claimedAgain).toMatchObject({ id: job.id, attempts: 2 })
  })
})
