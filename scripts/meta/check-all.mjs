#!/usr/bin/env node
/**
 * check-all.mjs — 顺序跑三个 checker，汇总退出码。
 * 任何 ERR 返回 1；配置/IO 错误返回 2。
 * 传 --json 时输出单个聚合 JSON（每个 checker 的 JSON 合并）。
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, printHelp } from './lib/common.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('check-all.mjs', '顺序运行 check-domain-doc / check-meta-docs / check-agent-tools / check-auth-permissions / check-boundaries / check-openspec-hygiene。')
  process.exit(0)
}

const here = dirname(fileURLToPath(import.meta.url))
const scripts = [
  'check-domain-doc.mjs',
  'check-meta-docs.mjs',
  'check-agent-tools.mjs',
  'check-auth-permissions.mjs',
  'check-boundaries.mjs',
  'check-audit-writes.mjs',
  'check-openspec-hygiene.mjs',
]
const passthrough = process.argv.slice(2)

if (!opts.json) {
  let failed = 0
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [join(here, script), ...passthrough], {
      stdio: 'inherit',
    })
    if (result.error) {
      console.error(`[ERR] 无法运行 ${script}：${result.error.message}`)
      process.exit(2)
    }
    if (result.status === 2) process.exit(2)
    if (result.status !== 0) failed++
  }
  process.exit(failed > 0 ? 1 : 0)
}

const args = passthrough.includes('--json') ? passthrough : [...passthrough, '--json']
const checks = []
for (const script of scripts) {
  const result = spawnSync(process.execPath, [join(here, script), ...args], {
    encoding: 'utf8',
  })
  if (result.error) {
    console.error(`[ERR] 无法运行 ${script}：${result.error.message}`)
    process.exit(2)
  }
  if (result.status === 2) {
    process.stderr.write(result.stderr || '')
    process.exit(2)
  }
  try {
    checks.push(JSON.parse(result.stdout))
  } catch {
    console.error(`[ERR] ${script} 的 --json 输出不是合法 JSON`)
    process.stderr.write(result.stdout || '')
    process.exit(2)
  }
}

const errors = checks.flatMap((check) => check.errors ?? [])
const warnings = checks.flatMap((check) => check.warnings ?? [])
console.log(JSON.stringify({
  check: 'check-all',
  checks: checks.map((check) => check.check),
  errors,
  warnings,
}, null, 2))
process.exit(errors.length > 0 && !opts.warnOnly ? 1 : 0)
