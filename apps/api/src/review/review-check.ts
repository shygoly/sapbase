export type ReviewCheckStatus = 'pass' | 'fail' | 'warn'

export interface ReviewCheckResult {
  status: ReviewCheckStatus
  evidence: Record<string, unknown>
}

export interface ReviewCheckProvider {
  readonly name: string
  check(input: Record<string, unknown>): Promise<ReviewCheckResult>
}

export class ReviewCheckError extends Error {
  constructor(message: string, readonly reason: 'unknown-provider' | 'duplicate') {
    super(message)
    this.name = 'ReviewCheckError'
  }
}

export class ReviewCheckRegistry {
  private readonly providers = new Map<string, ReviewCheckProvider>()

  register(provider: ReviewCheckProvider): void {
    if (!provider.name) throw new ReviewCheckError('provider 缺少 name', 'unknown-provider')
    if (this.providers.has(provider.name)) {
      throw new ReviewCheckError(`provider 重复注册：${provider.name}`, 'duplicate')
    }
    this.providers.set(provider.name, provider)
  }

  get(name: string): ReviewCheckProvider {
    const provider = this.providers.get(name)
    if (!provider) throw new ReviewCheckError(`未注册 check provider：${name}`, 'unknown-provider')
    return provider
  }

  list(): ReviewCheckProvider[] {
    return [...this.providers.values()]
  }
}

/**
 * 机器检测编排：provider 异常/未知/超时一律 fail-closed 成 fail；
 * warn 原样返回，必须由人工确认，不能当 pass。
 */
export class ReviewCheckService {
  constructor(private readonly registry: ReviewCheckRegistry) {}

  async run(
    name: string,
    input: Record<string, unknown>,
    options: { timeoutMs?: number } = {},
  ): Promise<ReviewCheckResult> {
    let provider: ReviewCheckProvider
    try {
      provider = this.registry.get(name)
    } catch (error) {
      return { status: 'fail', evidence: { error: (error as Error).message } }
    }
    const timeoutMs = options.timeoutMs ?? 30_000
    try {
      return await this.withTimeout(provider.check(input), timeoutMs)
    } catch (error) {
      return {
        status: 'fail',
        evidence: {
          error: error instanceof Error ? error.message : String(error),
          provider: name,
          timeout: error instanceof ReviewCheckTimeoutError,
        },
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new ReviewCheckTimeoutError(timeoutMs)), timeoutMs)
      timer.unref?.()
      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }
}

export class ReviewCheckTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`机器检测超时（${timeoutMs}ms）`)
    this.name = 'ReviewCheckTimeoutError'
  }
}
