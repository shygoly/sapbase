import { Injectable } from '@nestjs/common'
import { Validator } from 'jsonschema'
import type { JobBackoff, JobStatus } from './job-state'

export interface JobResult {
  result?: unknown
  progress?: number
}

export interface JobContext {
  jobId: string
  organizationId: string
  type: string
  typeVersion: number
  attempt: number
  /** 协作式取消：handler 在长循环里应主动检查。 */
  isCancelled(): Promise<boolean>
  /** 超时/取消时由 worker abort；handler 应把它传给 fetch 等可取消操作。 */
  signal: AbortSignal
  progress(progress: number, payload?: Record<string, unknown>): Promise<void>
  stage(stage: string, payload?: Record<string, unknown>): Promise<void>
  log(message: string, payload?: Record<string, unknown>): Promise<void>
}

export interface JobTypeDefinition<T = Record<string, unknown>> {
  type: string
  /** 缺省 1；同一 type 可并存多个版本。 */
  typeVersion?: number
  payloadSchema: Record<string, unknown>
  handler: (ctx: JobContext, payload: T) => Promise<JobResult | void>
  timeoutMs?: number
  maxAttempts?: number
  backoff?: JobBackoff
  /** 同类型跨 worker 的并发上限（v1 用数据库 running 计数近似）。 */
  concurrency?: number
  /** 缺省 0；数值越大越先领取。 */
  priority?: number
  idempotencyScope?: 'organization' | 'app' | 'global'
}

export interface JobRecord {
  id: string
  organizationId: string
  appInstallationId: string | null
  type: string
  typeVersion: number
  status: JobStatus
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: Record<string, unknown> | null
  progress: number
  idempotencyKey: string | null
  attempts: number
  maxAttempts: number
  runAt: Date | string
  startedAt: Date | string | null
  finishedAt: Date | string | null
  leaseUntil: Date | string | null
  workerId: string | null
  cancelRequested: boolean
  callbackUrl: string | null
  callbackSecretRef: string | null
  callbackStatus: string | null
  callbackAttempts: number
  createdBy: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

export class JobTypeError extends Error {
  constructor(
    message: string,
    readonly reason: 'duplicate' | 'invalid' | 'unknown' | 'invalid-payload',
  ) {
    super(message)
    this.name = 'JobTypeError'
  }
}

const TYPE_PATTERN = /^[a-z][a-z0-9_.-]*$/
const validator = new Validator()

function definitionKey(type: string, version: number): string {
  return `${type}@${version}`
}

/**
 * 任务类型注册表：启动时注册，未知类型拒绝入队。
 *
 * 校验在注册时做一次（重复/非法 schema/缺 handler），入队时再做 payload 校验。
 * 不在 worker 里临时解释任意脚本 —— 类型集合是白名单。
 */
@Injectable()
export class JobTypeRegistry {
  private readonly definitions = new Map<string, JobTypeDefinition>()

  register(definition: JobTypeDefinition): void {
    this.validateDefinition(definition)
    const version = definition.typeVersion ?? 1
    const key = definitionKey(definition.type, version)
    if (this.definitions.has(key)) {
      throw new JobTypeError(`任务类型重复注册：${key}`, 'duplicate')
    }
    this.definitions.set(key, { ...definition, typeVersion: version })
  }

  registerAll(definitions: readonly JobTypeDefinition[]): void {
    for (const definition of definitions) this.register(definition)
  }

  has(type: string, version = 1): boolean {
    return this.definitions.has(definitionKey(type, version))
  }

  get(type: string, version = 1): JobTypeDefinition {
    const definition = this.definitions.get(definitionKey(type, version))
    if (!definition) {
      throw new JobTypeError(`未知任务类型：${definitionKey(type, version)}`, 'unknown')
    }
    return definition
  }

  list(): JobTypeDefinition[] {
    return [...this.definitions.values()].sort((a, b) =>
      `${a.type}@${a.typeVersion ?? 1}`.localeCompare(`${b.type}@${b.typeVersion ?? 1}`),
    )
  }

  validatePayload(
    type: string,
    version: number,
    payload: unknown,
  ): { valid: boolean; errors: string[] } {
    const definition = this.get(type, version)
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return { valid: false, errors: ['payload 必须是对象'] }
    }
    const result = validator.validate(payload, definition.payloadSchema)
    return {
      valid: result.valid,
      errors: result.errors.map((error) => `${error.property}: ${error.message}`),
    }
  }

  /** 跨 worker 并发上限；缺省 1。 */
  concurrencyOf(type: string, version = 1): number {
    return this.get(type, version).concurrency ?? 1
  }

  private validateDefinition(definition: JobTypeDefinition): void {
    const version = definition.typeVersion ?? 1
    if (!TYPE_PATTERN.test(definition.type)) {
      throw new JobTypeError(
        `任务类型非法：${definition.type}（只允许小写字母开头，含 a-z0-9_.-）`,
        'invalid',
      )
    }
    if (!Number.isInteger(version) || version < 1) {
      throw new JobTypeError(`任务类型版本非法：${version}`, 'invalid')
    }
    if (typeof definition.handler !== 'function') {
      throw new JobTypeError(`任务类型 ${definition.type} 缺少 handler`, 'invalid')
    }
    if (
      !definition.payloadSchema ||
      typeof definition.payloadSchema !== 'object' ||
      definition.payloadSchema.type !== 'object'
    ) {
      throw new JobTypeError(
        `任务类型 ${definition.type} 的 payloadSchema 必须是 type=object 的 JSON Schema`,
        'invalid',
      )
    }
    if (definition.timeoutMs !== undefined && definition.timeoutMs <= 0) {
      throw new JobTypeError(`任务类型 ${definition.type} 的 timeoutMs 必须大于 0`, 'invalid')
    }
    if (definition.maxAttempts !== undefined && definition.maxAttempts < 1) {
      throw new JobTypeError(`任务类型 ${definition.type} 的 maxAttempts 至少为 1`, 'invalid')
    }
    if (definition.concurrency !== undefined && definition.concurrency < 1) {
      throw new JobTypeError(`任务类型 ${definition.type} 的 concurrency 至少为 1`, 'invalid')
    }
    if (definition.backoff) {
      if (
        definition.backoff.kind !== 'fixed' &&
        definition.backoff.kind !== 'exponential'
      ) {
        throw new JobTypeError(`任务类型 ${definition.type} 的 backoff.kind 非法`, 'invalid')
      }
      if (definition.backoff.baseMs < 1) {
        throw new JobTypeError(`任务类型 ${definition.type} 的 backoff.baseMs 至少为 1`, 'invalid')
      }
    }
  }
}
