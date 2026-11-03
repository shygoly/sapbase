#!/usr/bin/env node
/**
 * check-meta-docs.mjs — 校验 FLOWS.md / DECISIONS.md 与代码的一致性。
 * 契约见 docs/reference/03-contracts.md。零依赖。
 *
 * 规则：
 *   1. cron 三向对拍：FLOWS.md 调度总表 ↔ registry jobKey ↔ 代码装饰器 name。
 *   2. flow 块：id 唯一/格式合法，必填字段齐全，actor 路径与符号存在。
 *   3. decision 块：id 唯一/格式合法，必填字段齐全，status 合法。
 *   4. 代码 D-x 标记必须在 DECISIONS.md 注册（词边界，排除 TD-x）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createReporter,
  findFencedBlocks,
  loadConfig,
  parseArgs,
  parseSimpleYaml,
  pathFromRoot,
  printHelp,
  setDiff,
  splitInlineArray,
  splitLines,
  stripQuotes,
  symbolExists,
  walkFiles,
} from './lib/common.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('check-meta-docs.mjs', '校验 FLOWS.md / DECISIONS.md 与代码的一致性。')
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
const r = createReporter('check-meta-docs', ctx, opts)
const ignoreDirs = ctx.config.code.ignoreDirs ?? []

function readDoc(key) {
  const path = pathFromRoot(ctx, ctx.config.docs[key])
  if (!existsSync(path)) {
    r.err(ctx.config.docs[key], '文件不存在')
    return null
  }
  return readFileSync(path, 'utf8')
}

// ---------- FLOWS.md ----------
const flowsText = readDoc('flows')
let flowIds = new Map()
let flowsCron = new Set()
if (flowsText) {
  const lines = splitLines(flowsText)

  // 调度总表：第一列是反引号包裹的 jobKey
  for (const line of lines) {
    const m = line.match(/^\|\s*`([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)`\s*\|/)
    if (m) flowsCron.add(m[1])
  }
  if (flowsCron.size === 0) {
    r.err(ctx.config.docs.flows, '调度总表没有解析到 jobKey（第一列必须是 `<domain>.<action>`）')
  }

  // flow 块
  const flowBlocks = findFencedBlocks(lines, 'yaml flow')
  if (flowBlocks.length === 0) {
    r.warn(ctx.config.docs.flows, '没有 yaml flow 块（只有调度总表）')
  }
  for (const block of flowBlocks) {
    const fields = parseSimpleYaml(block.body)
    const id = fields.id
    const location = `${ctx.config.docs.flows}:${block.startLine}`

    if (!id || !/^FLOW-[A-Z0-9]+-\d+$/.test(id)) {
      r.err(location, `flow id 非法：${id ?? '(缺失)'}`)
      continue
    }
    if (flowIds.has(id)) {
      r.err(location, `flow id 重复：${id}（首次于 :${flowIds.get(id)}）`)
    } else {
      flowIds.set(id, block.startLine)
    }
    for (const key of ['name', 'trigger']) {
      if (!fields[key]) r.err(location, `flow ${id} 缺少字段 ${key}`)
    }

    const { steps, dead } = parseFlowSteps(block.body)
    if (steps.length === 0) {
      r.err(location, `flow ${id} 没有 steps`)
    }
    for (const [index, step] of steps.entries()) {
      if (!step.actor) {
        r.err(location, `flow ${id} 第 ${index + 1} 步缺少 actor`)
        continue
      }
      const hash = step.actor.indexOf('#')
      if (hash < 0) {
        r.err(location, `flow ${id} 第 ${index + 1} 步 actor 必须是 path#symbol：${step.actor}`)
        continue
      }
      const path = resolve(ctx.repoRoot, step.actor.slice(0, hash))
      const symbol = step.actor.slice(hash + 1)
      if (!existsSync(path)) {
        r.err(location, `flow ${id} actor 文件不存在：${step.actor.slice(0, hash)}`)
      } else if (!symbolExists(path, symbol)) {
        r.err(location, `flow ${id} actor 符号不存在：${step.actor}`)
      }
    }
    if (steps.length > 1 && dead.length === 0) {
      r.warn(location, `flow ${id} 有多步但没有 dead_edge_check`)
    }
    for (const pair of dead) {
      if (!pair.producer || !pair.consumer) {
        r.err(location, `flow ${id} dead_edge_check 缺少 producer/consumer`)
        continue
      }
      const producerOk = steps.some(
        (step) => step.actor.includes(pair.producer.split('→')[0].trim()) ||
          step.produces.some((p) => p.includes(pair.producer.split('→')[0].trim())),
      )
      const consumerOk = steps.some(
        (step) => step.actor.includes(pair.consumer.split('←')[0].trim()) ||
          step.consumes.some((c) => c.includes(pair.consumer.split('←')[0].trim())),
      )
      if (!producerOk) r.warn(location, `flow ${id} dead_edge producer 未匹配到任何 step：${pair.producer}`)
      if (!consumerOk) r.warn(location, `flow ${id} dead_edge consumer 未匹配到任何 step：${pair.consumer}`)
    }
  }
}

function parseFlowSteps(body) {
  const steps = []
  const dead = []
  let section = null
  let current = null

  for (const line of body) {
    if (/^steps:\s*$/.test(line)) {
      section = 'steps'
      current = null
      continue
    }
    if (/^dead_edge_check:\s*$/.test(line)) {
      section = 'dead'
      current = null
      continue
    }
    if (/^[A-Za-z_][\w-]*:\s*/.test(line)) {
      section = null
      current = null
      continue
    }

    if (section === 'steps') {
      const start = line.match(/^\s*-\s+actor:\s*(.+)$/)
      if (start) {
        current = { actor: stripQuotes(start[1]), produces: [], consumes: [] }
        steps.push(current)
        continue
      }
      if (current) {
        const field = line.match(/^\s+(produces|consumes):\s*(.*)$/)
        if (field) {
          current[field[1]] = field[2].trim().startsWith('[')
            ? splitInlineArray(field[2].trim())
            : (field[2].trim() ? [stripQuotes(field[2].trim())] : [])
        }
      }
    }

    if (section === 'dead') {
      const start = line.match(/^\s*-\s+producer:\s*(.+)$/)
      if (start) {
        current = { producer: stripQuotes(start[1]), consumer: '' }
        dead.push(current)
        continue
      }
      if (current) {
        const consumer = line.match(/^\s+consumer:\s*(.+)$/)
        if (consumer) current.consumer = stripQuotes(consumer[1])
      }
    }
  }

  return { steps, dead }
}

// ---------- registry 与代码装饰器 ----------
const registryPath = pathFromRoot(ctx, ctx.config.cron.registry)
const registryKeys = new Set()
if (!existsSync(registryPath)) {
  r.err(ctx.config.cron.registry, 'registry 文件不存在')
} else {
  const text = readFileSync(registryPath, 'utf8')
  for (const m of text.matchAll(/jobKey:\s*['"]([^'"]+)['"]/g)) registryKeys.add(m[1])
}

const codeNames = new Set()
for (const root of ctx.config.code.roots ?? []) {
  for (const file of walkFiles(pathFromRoot(ctx, root), {
    extensions: ['.ts', '.tsx'],
    ignoreDirs,
  })) {
    const text = readFileSync(file, 'utf8')
    for (const pattern of ctx.config.cron.decoratorPatterns ?? []) {
      let re
      try {
        re = new RegExp(pattern, 'g')
      } catch (error) {
        r.err('meta.config.json', `cron.decoratorPatterns 非法：${pattern}（${error.message}）`)
        continue
      }
      for (const m of text.matchAll(re)) codeNames.add(m[1])
    }
  }
}

const flowsVsRegistry = setDiff(flowsCron, registryKeys)
const registryVsFlows = setDiff(registryKeys, flowsCron)
const flowsVsCode = setDiff(flowsCron, codeNames)
const codeVsFlows = setDiff(codeNames, flowsCron)

if (flowsVsRegistry.length) r.err('FLOWS.md', `调度总表有但 registry 无：${flowsVsRegistry.join(', ')}`)
if (registryVsFlows.length) r.err('registry', `registry 有但 FLOWS.md 无：${registryVsFlows.join(', ')}`)
if (flowsVsCode.length) r.err('FLOWS.md', `调度总表有但代码装饰器无：${flowsVsCode.join(', ')}`)
if (codeVsFlows.length) r.err('code', `代码装饰器有但 FLOWS.md 无：${codeVsFlows.join(', ')}`)

// ---------- DECISIONS.md ----------
const decisionsText = readDoc('decisions')
let decisionIds = new Set()
if (decisionsText) {
  const lines = splitLines(decisionsText)
  for (const block of findFencedBlocks(lines, 'yaml decision')) {
    const fields = parseSimpleYaml(block.body)
    const id = fields.id
    const location = `${ctx.config.docs.decisions}:${block.startLine}`

    if (!id || !/^D-\d+$/.test(id)) {
      r.err(location, `decision id 非法：${id ?? '(缺失)'}`)
      continue
    }
    if (decisionIds.has(id)) {
      r.err(location, `decision id 重复：${id}`)
    } else {
      decisionIds.add(id)
    }
    for (const key of ['title', 'decision', 'status']) {
      if (!fields[key]) r.err(location, `decision ${id} 缺少字段 ${key}`)
    }
    if (fields.status && !['proposed', 'accepted', 'superseded', 'deprecated'].includes(fields.status)) {
      r.err(location, `decision ${id} status 非法：${fields.status}`)
    }

    const markers = Array.isArray(fields.code_markers)
      ? fields.code_markers
      : (fields.code_markers ? [fields.code_markers] : [])
    for (const marker of markers) {
      const clean = marker.replace(/\s*\(.*\)\s*$/, '').trim()
      if (clean && !existsSync(resolve(ctx.repoRoot, clean))) {
        r.warn(location, `decision ${id} 的 code_marker 不存在：${clean}`)
      }
    }
  }
  if (decisionIds.size === 0) r.err(ctx.config.docs.decisions, '未找到任何 yaml decision 块')
}

// ---------- 代码 D-x 标记 ----------
const codeD = new Set()
for (const root of ctx.config.code.roots ?? []) {
  for (const file of walkFiles(pathFromRoot(ctx, root), {
    extensions: ['.ts', '.tsx', '.js', '.mjs'],
    ignoreDirs,
  })) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/(^|[^A-Za-z0-9])D-(\d+)/g)) {
      codeD.add(`D-${m[2]}`)
    }
  }
}
for (const id of [...codeD].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)))) {
  if (!decisionIds.has(id)) r.err('code', `代码里的 ${id} 标记未在 DECISIONS.md 注册`)
}

r.finish(
  `cron ${flowsCron.size}(FLOWS)/${registryKeys.size}(registry)/${codeNames.size}(code), ` +
  `flow ${flowIds.size} 条, decision ${decisionIds.size} 条`,
)
