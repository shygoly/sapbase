/**
 * Simple in-memory rate limiter for patch operations.
 *
 * It is intentionally process-local: this is a safety valve for a single runtime,
 * not a distributed quota. Deployments with multiple replicas should put the same
 * limit in front of the API gateway as well.
 */
export interface PatchRateLimitOptions {
  windowMs?: number
  max?: number
}

export interface PatchRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export class PatchRateLimiter {
  private readonly windowMs: number
  private readonly max: number
  private readonly hits = new Map<string, number[]>()

  constructor(options: PatchRateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000
    this.max = options.max ?? 120
  }

  check(key: string, now: number = Date.now()): PatchRateLimitResult {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff)

    if (recent.length >= this.max) {
      const oldest = recent[0] ?? now
      this.hits.set(key, recent)
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + this.windowMs - now),
      }
    }

    recent.push(now)
    this.hits.set(key, recent)

    return {
      allowed: true,
      remaining: Math.max(0, this.max - recent.length),
      retryAfterMs: 0,
    }
  }

  reset(key?: string): void {
    if (key) this.hits.delete(key)
    else this.hits.clear()
  }
}
