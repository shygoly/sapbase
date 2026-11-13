import { of } from 'rxjs'
import { LegacyTenantApiDeprecationInterceptor } from './legacy-tenant-api-deprecation.interceptor'

function context(headers: Record<string, string>) {
  const setHeader = jest.fn()
  return {
    setHeader,
    execution: {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({ setHeader }),
      }),
    } as never,
  }
}

describe('LegacyTenantApiDeprecationInterceptor', () => {
  it('没有 X-App-Id：添加 Deprecation/Sunset/Link/Warning', () => {
    const { execution, setHeader } = context({})
    const interceptor = new LegacyTenantApiDeprecationInterceptor()
    let emitted = false
    interceptor.intercept(execution, { handle: () => (emitted = true, of({})) } as never)
    expect(emitted).toBe(true)
    expect(setHeader).toHaveBeenCalledWith('Deprecation', 'true')
    expect(setHeader).toHaveBeenCalledWith(
      'Sunset',
      'Wed, 30 Jun 2027 00:00:00 GMT',
    )
    expect(setHeader).toHaveBeenCalledWith(
      'Link',
      '</docs/protocols/api-deprecation.md>; rel="deprecation"',
    )
    expect(setHeader).toHaveBeenCalledWith(
      'Warning',
      expect.stringContaining('X-App-Id'),
    )
  })

  it('有 X-App-Id：不添加弃用 header', () => {
    const { execution, setHeader } = context({ 'x-app-id': 'app-1' })
    const interceptor = new LegacyTenantApiDeprecationInterceptor()
    interceptor.intercept(execution, { handle: () => of({}) } as never)
    expect(setHeader).not.toHaveBeenCalled()
  })

  it('空白 X-App-Id 视为缺失，仍走兼容提示', () => {
    const { execution, setHeader } = context({ 'x-app-id': '   ' })
    const interceptor = new LegacyTenantApiDeprecationInterceptor()
    interceptor.intercept(execution, { handle: () => of({}) } as never)
    expect(setHeader).toHaveBeenCalledWith('Deprecation', 'true')
  })
})
