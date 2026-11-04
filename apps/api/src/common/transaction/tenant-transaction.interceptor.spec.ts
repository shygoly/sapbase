import { of } from 'rxjs'
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor'

jest.mock('typeorm-transactional', () => ({
  runInTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

function executionContext(request: Record<string, unknown>) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as never
}

describe('TenantTransactionInterceptor', () => {
  it('在事务内写入组织、应用和用户上下文后再执行 handler', async () => {
    const query = jest.fn(async () => [])
    const interceptor = new TenantTransactionInterceptor({ query } as never)
    const request = {
      organizationId: 'org-1',
      user: { id: 'user-1', organizationId: 'org-1' },
      appContext: { appInstallationId: 'app-1' },
    }
    const next = { handle: jest.fn(() => of({ ok: true })) }

    const result = await new Promise((resolve, reject) => {
      interceptor.intercept(executionContext(request), next as never).subscribe({
        next: resolve,
        error: reject,
      })
    })

    expect(result).toEqual({ ok: true })
    expect(query).toHaveBeenCalledWith(expect.any(String), ['org-1', 'app-1', 'user-1'])
    const sql = String((query as jest.Mock).mock.calls[0][0])
    expect(sql).toContain(`set_config('app.organization_id'`)
    expect(sql).toContain(`set_config('app.app_installation_id'`)
    expect(sql).toContain(`set_config('app.user_id'`)
  })

  it('无身份请求不开启租户事务', async () => {
    const query = jest.fn()
    const interceptor = new TenantTransactionInterceptor({ query } as never)
    const next = { handle: jest.fn(() => of('public')) }
    await new Promise<void>((resolve) => {
      interceptor.intercept(executionContext({ headers: {} }), next as never).subscribe({
        complete: resolve,
      })
    })
    expect(query).not.toHaveBeenCalled()
    expect(next.handle).toHaveBeenCalled()
  })
})
