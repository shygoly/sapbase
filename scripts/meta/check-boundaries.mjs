#!/usr/bin/env node
/**
 * check-boundaries.mjs — 按 Nx project graph 校验依赖方向（规则 B0–B5）。
 *
 * 为什么需要它，而不是只靠 ESLint：
 *   1. `@nx/enforce-module-boundaries` 的 `onlyDependOnLibsWithTags` 表达不了
 *      「同层但不同 scope 禁止」（B3）；
 *   2. 直接跑 `eslint` 时若拿不到 ProjectGraph，整条规则会被静默跳过
 *      （实测输出 `No cached ProjectGraph is available. The rule will be skipped.`）。
 *
 * 本脚本读 graph JSON 做确定性断言，输出与其它 checker 同形态（--json / --baseline）。
 *
 * 用法：
 *   node scripts/meta/check-boundaries.mjs
 *   node scripts/meta/check-boundaries.mjs --graph .nx/boundary-graph.json
 *   node scripts/meta/check-boundaries.mjs --json
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createReporter, loadConfig, parseArgs, printHelp } from './lib/common.mjs'
import { evaluateGraph } from './lib/boundaries.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('check-boundaries.mjs', '按 Nx project graph 校验依赖方向（B0–B5）。')
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

function readGraphFrom(file) {
  if (!existsSync(file)) throw new Error(`graph 文件不存在：${file}`)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`graph 文件不是合法 JSON：${error.message}`)
  }
}

function readGraph() {
  if (opts.graph) return readGraphFrom(resolve(ctx.repoRoot, opts.graph))

  const nxBin = join(ctx.repoRoot, 'node_modules', '.bin', 'nx')
  if (!existsSync(nxBin)) {
    throw new Error(
      `找不到 ${nxBin}；请先在仓库根执行 npm install，或用 --graph 指定已导出的图`,
    )
  }
  const dir = mkdtempSync(join(tmpdir(), 'sap-boundaries-'))
  const file = join(dir, 'graph.json')
  try {
    const run = spawnSync(nxBin, ['graph', `--file=${file}`], {
      cwd: ctx.repoRoot,
      encoding: 'utf8',
    })
    if (run.error) throw new Error(`无法运行 nx graph：${run.error.message}`)
    if (run.status !== 0) {
      throw new Error(`nx graph 失败（exit ${run.status}）：${(run.stderr || '').trim()}`)
    }
    return readGraphFrom(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

let graph
try {
  graph = readGraph()
} catch (error) {
  console.error(`[ERR] ${error.message}`)
  process.exit(2)
}

const result = evaluateGraph(graph)
const r = createReporter('check-boundaries', ctx, opts)

for (const violation of result.violations) {
  const location = violation.target
    ? `${violation.source} → ${violation.target}`
    : violation.source
  r.err(location, violation.message)
}

const { projects, edges } = result.summary
r.finish(
  `${projects} project(s), ${edges} edge(s); ` +
    `规则 B0–B5：${result.violations.length} violation(s)`,
)
