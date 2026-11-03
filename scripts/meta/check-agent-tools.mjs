#!/usr/bin/env node
/**
 * check-agent-tools.mjs — 校验 contracts/tools.json ↔ AGENT-TOOLS.md ↔ 处理器。
 * 契约见 docs/reference/03-contracts.md。零依赖。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cellsOf,
  createReporter,
  findTable,
  loadConfig,
  parseArgs,
  parsePathSymbol,
  pathFromRoot,
  printHelp,
  setDiff,
  splitLines,
  stripQuotes,
  symbolExists,
  walkFiles,
} from './lib/common.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('check-agent-tools.mjs', '校验工具契约、人读索引与处理器。')
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
const r = createReporter('check-agent-tools', ctx, opts)

function stripTick(value) {
  return String(value ?? '').trim().replace(/^`|`$/g, '')
}

function boolOf(value) {
  const v = stripTick(value).toLowerCase()
  if (['是', 'yes', 'true', '1'].includes(v)) return true
  if (['否', 'no', 'false', '0'].includes(v)) return false
  return null
}

function listOf(value) {
  const raw = stripTick(value)
  if (!raw || raw === '-') return []
  return raw.split(/[,，、]/).map((s) => stripTick(s)).filter(Boolean)
}

// ---------- tools.json ----------
const contractPath = pathFromRoot(ctx, ctx.config.agentTools.contract)
let tools = []
if (!existsSync(contractPath)) {
  r.err(ctx.config.agentTools.contract, '工具契约文件不存在')
} else {
  let raw
  try {
    raw = JSON.parse(readFileSync(contractPath, 'utf8'))
  } catch (error) {
    r.err(ctx.config.agentTools.contract, `不是合法 JSON：${error.message}`)
    raw = null
  }
  tools = Array.isArray(raw?.tools) ? raw.tools : []
  if (tools.length === 0) r.err(ctx.config.agentTools.contract, '没有 tools')
}

const toolsMap = new Map()
for (const tool of tools) {
  const name = tool?.name
  const location = `${ctx.config.agentTools.contract}${name ? `:${name}` : ''}`
  if (!name || !/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) {
    r.err(location, `工具名非法：${name ?? '(缺失)'}`)
    continue
  }
  if (toolsMap.has(name)) r.err(location, `工具名重复：${name}`)
  toolsMap.set(name, tool)

  if (!tool.description || String(tool.description).trim().length === 0) {
    r.err(location, '缺少 description')
  }
  if (!tool.parameters || tool.parameters.type !== 'object') {
    r.err(location, 'parameters 必须是 type=object 的 JSON Schema')
  }
  if (!tool.permission || !/^tool:[a-z0-9-]+(:[a-z0-9-]+)+$/.test(tool.permission)) {
    r.err(location, `permission 非法：${tool.permission ?? '(缺失)'}`)
  }
  if (typeof tool.write !== 'boolean') {
    r.err(location, 'write 必须是 boolean')
  }
  if (!['none', 'required'].includes(tool.confirmation)) {
    r.err(location, `confirmation 非法：${tool.confirmation ?? '(缺失)'}`)
  }
  if (tool.write === true && tool.confirmation !== 'required') {
    r.err(location, '写工具必须 confirmation=required（智能体不能自己确认）')
  }
  if (tool.write === false && !['none', 'required'].includes(tool.confirmation)) {
    r.err(location, '读工具的 confirmation 必须是 none 或 required')
  }
  if (tool.timeoutMs !== undefined && (!Number.isInteger(tool.timeoutMs) || tool.timeoutMs < 100 || tool.timeoutMs > 60000)) {
    r.err(location, `timeoutMs 必须在 100–60000：${tool.timeoutMs}`)
  }
  if (tool.untrustedResult !== undefined && typeof tool.untrustedResult !== 'boolean') {
    r.err(location, 'untrustedResult 必须是 boolean')
  }
  if (tool.sensitiveArgs !== undefined && !Array.isArray(tool.sensitiveArgs)) {
    r.err(location, 'sensitiveArgs 必须是数组')
  }
  if (tool.allowedAgents !== undefined) {
    if (!Array.isArray(tool.allowedAgents)) {
      r.err(location, 'allowedAgents 必须是数组')
    } else {
      for (const agent of tool.allowedAgents) {
        if (!/^[a-z][a-z0-9-]*\*?$/.test(agent)) r.err(location, `allowedAgents 含非法值：${agent}`)
      }
    }
  }
}

// ---------- AGENT-TOOLS.md ----------
const docPath = pathFromRoot(ctx, ctx.config.docs.agentTools)
let docMap = new Map()
let docRows = 0
if (!existsSync(docPath)) {
  r.err(ctx.config.docs.agentTools, '文件不存在')
} else {
  const lines = splitLines(readFileSync(docPath, 'utf8'))
  const table = findTable(lines, [
    '工具',
    '权限',
    '写',
    '确认',
    '超时(ms)',
    '不可信结果',
    '敏感参数',
    '允许的智能体',
    '处理器',
  ])
  if (!table) {
    r.err(ctx.config.docs.agentTools, '找不到工具表（表头必须恰为 9 列，见 03-contracts.md §5.2）')
  } else {
    for (const row of table.rows) {
      const location = `${ctx.config.docs.agentTools}:${row.line}`
      const cells = row.cells
      if (cells.length < 9) {
        r.err(location, `工具表行不足 9 列：${cells.length}`)
        continue
      }
      docRows++
      const [nameCell, permission, writeCell, confirmation, timeoutCell, untrustedCell, sensitiveCell, agentsCell, handlerCell] = cells
      const name = stripTick(nameCell)
      if (!name) {
        r.err(location, '工具名不能为空')
        continue
      }
      if (docMap.has(name)) r.err(location, `工具表重复：${name}`)
      docMap.set(name, {
        line: row.line,
        permission: stripTick(permission),
        write: boolOf(writeCell),
        confirmation: stripTick(confirmation),
        timeoutMs: Number(stripTick(timeoutCell)),
        untrustedResult: boolOf(untrustedCell),
        sensitiveArgs: listOf(sensitiveCell),
        allowedAgents: listOf(agentsCell),
        agentsWildcard: stripTick(agentsCell) === '*',
        handler: stripTick(handlerCell),
      })
    }
  }
}

for (const name of setDiff(new Set(toolsMap.keys()), new Set(docMap.keys()))) {
  r.err(ctx.config.docs.agentTools, `tools.json 有但 AGENT-TOOLS.md 无：${name}`)
}
for (const name of setDiff(new Set(docMap.keys()), new Set(toolsMap.keys()))) {
  r.err(ctx.config.docs.agentTools, `AGENT-TOOLS.md 有但 tools.json 无：${name}`)
}

for (const [name, tool] of toolsMap) {
  const doc = docMap.get(name)
  if (!doc) continue
  const location = `${ctx.config.docs.agentTools}:${doc.line}`
  if (doc.permission !== tool.permission) {
    r.err(location, `${name} 权限不一致：doc=${doc.permission} json=${tool.permission}`)
  }
  if (doc.write !== tool.write) {
    r.err(location, `${name} write 不一致：doc=${doc.write} json=${tool.write}`)
  }
  if (doc.confirmation !== tool.confirmation) {
    r.err(location, `${name} confirmation 不一致：doc=${doc.confirmation} json=${tool.confirmation}`)
  }
  const timeout = tool.timeoutMs ?? 5000
  if (doc.timeoutMs !== timeout) {
    r.err(location, `${name} timeoutMs 不一致：doc=${doc.timeoutMs} json=${timeout}`)
  }
  const untrusted = tool.untrustedResult ?? false
  if (doc.untrustedResult !== untrusted) {
    r.err(location, `${name} untrustedResult 不一致：doc=${doc.untrustedResult} json=${untrusted}`)
  }
  const sensitive = [...(tool.sensitiveArgs ?? [])].sort()
  const docSensitive = [...doc.sensitiveArgs].sort()
  if (JSON.stringify(sensitive) !== JSON.stringify(docSensitive)) {
    r.err(location, `${name} sensitiveArgs 不一致：doc=[${docSensitive}] json=[${sensitive}]`)
  }
  const agents = [...(tool.allowedAgents ?? [])].sort()
  const docAgents = [...doc.allowedAgents].sort()
  if (doc.agentsWildcard) {
    if (agents.length > 0) r.err(location, `${name} doc 写 * 但 json 限定了 allowedAgents`)
  } else if (JSON.stringify(agents) !== JSON.stringify(docAgents)) {
    r.err(location, `${name} allowedAgents 不一致：doc=[${docAgents}] json=[${agents}]`)
  }

  if (doc.handler && doc.handler !== '-') {
    const { path, symbol } = parsePathSymbol(doc.handler)
    const abs = resolve(ctx.repoRoot, path)
    if (!existsSync(abs)) {
      r.err(location, `${name} 处理器文件不存在：${path}`)
    } else if (!symbol) {
      r.err(location, `${name} 处理器必须写成 path#symbol`)
    } else if (!symbolExists(abs, symbol)) {
      r.err(location, `${name} 处理器符号不存在：${doc.handler}`)
    }
  }
}

// ---------- 处理器注册表 ----------
const handlers = new Set()
for (const root of ctx.config.agentTools.handlerRoots ?? []) {
  const abs = pathFromRoot(ctx, root)
  for (const file of walkFiles(abs, {
    extensions: ['.ts', '.tsx'],
    ignoreDirs: ctx.config.code.ignoreDirs ?? [],
  })) {
    const text = readFileSync(file, 'utf8')
    let re
    try {
      re = new RegExp(ctx.config.agentTools.handlerPattern, 'g')
    } catch (error) {
      r.err('meta.config.json', `agentTools.handlerPattern 非法：${error.message}`)
      continue
    }
    for (const m of text.matchAll(re)) handlers.add(m[1])
  }
}

if (handlers.size > 0) {
  for (const name of setDiff(handlers, new Set(toolsMap.keys()))) {
    const message = `处理器有但 tools.json 无：${name}`
    if (ctx.config.agentTools.strictHandlers) r.err('handlers', message)
    else r.warn('handlers', message)
  }
  for (const [name, tool] of toolsMap) {
    if (handlers.has(name)) continue
    const doc = docMap.get(name)
    if (doc && doc.handler === '-') continue
    const message = `tools.json 有但未扫描到处理器：${name}`
    if (ctx.config.agentTools.strictHandlers) r.err('handlers', message)
    else r.warn('handlers', message)
  }
}

r.finish(`tools ${toolsMap.size}, doc rows ${docRows}, handlers ${handlers.size}`)
