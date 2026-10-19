import { RlsPolicyService } from './rls-policy.service'

describe('RlsPolicyService', () => {
  const original = process.env.RLS_ENFORCEMENT

  afterEach(() => {
    if (original === undefined) delete process.env.RLS_ENFORCEMENT
    else process.env.RLS_ENFORCEMENT = original
  })

  it('默认关闭时不查库', async () => {
    delete process.env.RLS_ENFORCEMENT
    const query = jest.fn()
    await new RlsPolicyService({ query } as never).onApplicationBootstrap()
    expect(query).not.toHaveBeenCalled()
  })

  it('required 且应用角色是 owner 时拒绝启动', async () => {
    process.env.RLS_ENFORCEMENT = 'required'
    const query = jest.fn(async () => [
      {
        currentRole: 'sapbase_owner',
        bypassesRls: false,
        ownsProtectedTable: true,
        protectedPolicyCount: 20,
      },
    ])
    await expect(
      new RlsPolicyService({ query } as never).onApplicationBootstrap(),
    ).rejects.toThrow(/RLS 不会拦截|ownsProtectedTable/)
  })

  it('required 且应用角色不具备绕过能力时通过', async () => {
    process.env.RLS_ENFORCEMENT = 'required'
    const query = jest.fn(async () => [
      {
        currentRole: 'sapbase_app',
        bypassesRls: false,
        ownsProtectedTable: false,
        protectedPolicyCount: 20,
      },
    ])
    await expect(
      new RlsPolicyService({ query } as never).onApplicationBootstrap(),
    ).resolves.toBeUndefined()
  })

  it('required 但 RLS 策略不存在时拒绝启动', async () => {
    process.env.RLS_ENFORCEMENT = 'required'
    const query = jest.fn(async () => [
      {
        currentRole: 'sapbase_app',
        bypassesRls: false,
        ownsProtectedTable: false,
        protectedPolicyCount: 0,
      },
    ])
    await expect(
      new RlsPolicyService({ query } as never).onApplicationBootstrap(),
    ).rejects.toThrow(/RLS 策略|迁移未完成/)
  })
})
