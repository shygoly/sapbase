import { ASYNC_JOB_DDL } from './jobs.ddl'
import { PLATFORM_CORE_ENTITIES } from '../platform-core.entities'
import { TENANT_RLS_DDL } from '../common/rls/tenant-rls.ddl'

describe('async job DDL/registration', () => {
  const joined = ASYNC_JOB_DDL.join('\n')

  it('创建 jobs / job_attempts / job_events', () => {
    for (const table of ['jobs', 'job_attempts', 'job_events']) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
    expect(joined).toContain('UQ_jobs_idempotency')
    expect(joined).toContain('UQ_job_attempts_job_attempt')
    expect(joined).toContain('UQ_job_events_job_seq')
  })

  it('实体注册包含 Job/JobAttempt/JobEvent', () => {
    const names = PLATFORM_CORE_ENTITIES.map((entity) => entity.name)
    expect(names).toEqual(expect.arrayContaining(['Job', 'JobAttempt', 'JobEvent']))
  })

  it('RLS 覆盖 jobs 与子表', () => {
    const rls = TENANT_RLS_DDL.join('\n')
    expect(rls).toContain(`to_regclass('public.jobs') IS NOT NULL`)
    expect(rls).toContain('tenant_parent_isolation ON public.job_attempts')
    expect(rls).toContain('tenant_parent_isolation ON public.job_events')
  })
})
