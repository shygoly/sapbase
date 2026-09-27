/**
 * 最小结构化日志（N3）：一行一条，可由 LOG_FORMAT=json|text 切换。
 * 缺省 text，保持现有开发体验。不做 OTel / Prometheus。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

/** 这些键不许进日志：整份 record.data、许可证私钥、密钥。 */
const SENSITIVE_KEY =
  /^(data|privateKey|privatePem|apiKey|password|secret|token|authorization|licenseKey)$/i

const LAST_ERROR_MAX = 200

export type LogSink = (line: string) => void

let sink: LogSink = (line) => {
  process.stdout.write(`${line}\n`)
}

/** 测试用：替换输出槽。传 undefined 恢复 stdout。 */
export function setLogSink(next?: LogSink): void {
  sink = next ?? ((line) => {
    process.stdout.write(`${line}\n`)
  })
}

export function collectLogs(run: () => void): string[] {
  const lines: string[] = []
  const previous = sink
  sink = (line) => {
    lines.push(line)
  }
  try {
    run()
    return lines
  } finally {
    sink = previous
  }
}

export async function collectLogsAsync(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  const previous = sink
  sink = (line) => {
    lines.push(line)
  }
  try {
    await run()
    return lines
  } finally {
    sink = previous
  }
}

function logFormat(): 'json' | 'text' {
  return process.env.LOG_FORMAT === 'json' ? 'json' : 'text'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

/** 去掉敏感键；lastError 截断，避免把整段异常/私钥打进去。 */
export function redactFields(fields: LogFields): LogFields {
  const out: LogFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) continue
    if (key === 'lastError' && typeof value === 'string' && value.length > LAST_ERROR_MAX) {
      out[key] = `${value.slice(0, LAST_ERROR_MAX)}…`
      continue
    }
    if (isPlainObject(value)) {
      out[key] = redactFields(value)
      continue
    }
    out[key] = value
  }
  return out
}

function formatText(ts: string, level: LogLevel, message: string, fields: LogFields): string {
  const parts = [`${ts} ${level.toUpperCase()} ${message}`]
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    parts.push(`${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  return parts.join(' ')
}

export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  const ts = new Date().toISOString()
  const safe = redactFields(fields)
  if (logFormat() === 'json') {
    sink(JSON.stringify({ ts, level, msg: message, ...safe }))
    return
  }
  sink(formatText(ts, level, message, safe))
}

export function logTransition(fields: {
  blueprintId: string
  entity: string
  recordId: string
  from: string
  to: string
  version: number
}): void {
  log('info', 'transition', fields)
}

export function logApprove(fields: {
  ruleId: string
  stepIndex: number
  role: string
  result: string
}): void {
  log('info', 'approve', fields)
}

export function logImportMaster(fields: {
  entity: string
  imported: number
  failed: number
  dryRun: boolean
}): void {
  log('info', 'importMaster', fields)
}

export function logOutboxDelivery(fields: {
  eventId: string
  topic: string
  outcome: 'delivered' | 'failed'
  attempts: number
  lastError?: string | null
}): void {
  const level = fields.outcome === 'failed' ? 'warn' : 'info'
  log(level, `outbox.${fields.outcome}`, {
    eventId: fields.eventId,
    topic: fields.topic,
    outcome: fields.outcome,
    attempts: fields.attempts,
    ...(fields.lastError ? { lastError: fields.lastError } : {}),
  })
}
