#!/usr/bin/env node
/**
 * check-audit-writes.mjs — 禁止业务模块直写 audit_logs。
 *
 * 允许的写入点只有：
 *   - libs/platform-core/src/audit-logs/audit-chain.service.ts（链写入）
 *   - libs/platform-core/src/audit-logs/audit-logs.service.ts（统一入口）
 *   - libs/platform-core/src/audit-logs/audit-retention.service.ts（break-glass 清理/恢复）
 *   - migrations / *.ddl.ts（结构定义）
 *
 * 用法：node scripts/meta/check-audit-writes.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const json = process.argv.includes('--json')

const ALLOWED = new Set([
  'libs/platform-core/src/audit-logs/audit-chain.service.ts',
  'libs/platform-core/src/audit-logs/audit-logs.service.ts',
  'libs/platform-core/src/audit-logs/audit-retention.service.ts',
])

const errors = []
const warnings = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (['node_modules', 'dist', '.next', 'coverage'].includes(entry)) continue
      walk(path)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\./.test(entry) || /-spec\.ts$/.test(entry)) continue
    if (path.includes('/test/') || path.includes('/seeds/')) continue
    if (entry.endsWith('.ddl.ts')) continue
    check(path)
  }
}

function check(path) {
  const rel = relative(ROOT, path)
  if (ALLOWED.has(rel)) return
  if (rel.includes('/migrations/')) return
  const text = readFileSync(path, 'utf8')
  if (!text.includes('audit_logs') && !text.includes('AuditLog')) return

  const repoWrite =
    /getRepository\(\s*AuditLog\s*\)[\s\S]{0,200}\.(save|update|delete|insert|upsert)\s*\(/.test(
      text,
    )
  const rawInsert = /INSERT\s+INTO\s+(public\.)?audit_logs/i.test(text)
  const rawUpdate = /UPDATE\s+(public\.)?audit_logs/i.test(text)
  const rawDelete = /DELETE\s+FROM\s+(public\.)?audit_logs/i.test(text)
  if (repoWrite) {
    errors.push(`${rel}: 直接通过 Repository 写 audit_logs；必须走 AuditLogsService/AuditChainService`)
  }
  if (rawInsert || rawUpdate || rawDelete) {
    errors.push(`${rel}: 直接 SQL 写 audit_logs；必须走 AuditLogsService/AuditChainService`)
  }
}

for (const dir of ['apps', 'libs']) walk(join(ROOT, dir))

const result = {
  check: 'check-audit-writes',
  errors,
  warnings,
  summary: `errors ${errors.length}, warnings ${warnings.length}; 允许写入点 ${ALLOWED.size} 个`,
}
if (json) {
  console.log(JSON.stringify(result, null, 2))
} else if (errors.length > 0) {
  for (const error of errors) console.error(`[ERR] ${error}`)
  console.log(result.summary)
} else {
  console.log(`check-audit-writes: 0 error(s), 0 warning(s); 允许写入点 ${ALLOWED.size} 个`)
}
process.exit(errors.length > 0 ? 1 : 0)
