import { JobWakeupService } from './job-wakeup'

describe('JobWakeupService', () => {
  const saved = {
    url: process.env.JOBS_WAKEUP_REDIS_URL,
    redisUrl: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
  }

  afterEach(() => {
    for (const [key, value] of Object.entries({
      JOBS_WAKEUP_REDIS_URL: saved.url,
      REDIS_URL: saved.redisUrl,
      REDIS_HOST: saved.host,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('未配置 Redis → 禁用且 publish/subscribe 是 no-op', async () => {
    delete process.env.JOBS_WAKEUP_REDIS_URL
    delete process.env.REDIS_URL
    delete process.env.REDIS_HOST
    const service = new JobWakeupService()
    expect(service.isEnabled).toBe(false)
    await expect(service.publish('job-1')).resolves.toBeUndefined()
    await expect(service.subscribe(() => undefined)).resolves.toBeUndefined()
  })

  it('配置 Redis 但连接失败 → publish 不抛错（poll 兜底）', async () => {
    process.env.JOBS_WAKEUP_REDIS_URL = 'redis://127.0.0.1:1'
    const service = new JobWakeupService()
    expect(service.isEnabled).toBe(true)
    await expect(service.publish('job-1')).resolves.toBeUndefined()
  })
})
