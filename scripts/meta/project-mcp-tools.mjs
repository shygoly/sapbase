#!/usr/bin/env node
/**
 * project-mcp-tools.mjs — 把 contracts/tools.json 投影成 MCP 工具清单。
 *
 *   node scripts/meta/project-mcp-tools.mjs            # 写 contracts/mcp-tools.json
 *   node scripts/meta/project-mcp-tools.mjs --check    # 只比对，有漂移则退出码 1
 *
 * 生成物与契约必须逐字节一致；漂移由 check-agent-tools.mjs 一并把守。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs, pathFromRoot, printHelp, loadConfig } from './lib/common.mjs'
import { projectManifest, diffManifests, stableStringify } from './lib/mcp-projection.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('project-mcp-tools.mjs', '由工具契约生成 MCP 清单（--check 只校验）。')
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

const contractRel = ctx.config.agentTools?.contract ?? 'contracts/tools.json'
const manifestRel = ctx.config.agentTools?.mcpManifest ?? 'contracts/mcp-tools.json'
const contractPath = pathFromRoot(ctx, contractRel)
const manifestPath = pathFromRoot(ctx, manifestRel)

if (!existsSync(contractPath)) {
  console.error(`[ERR] 工具契约不存在：${contractRel}`)
  process.exit(2)
}

let raw
try {
  raw = JSON.parse(readFileSync(contractPath, 'utf8'))
} catch (error) {
  console.error(`[ERR] ${contractRel} 不是合法 JSON：${error.message}`)
  process.exit(2)
}

const tools = Array.isArray(raw?.tools) ? raw.tools : []
if (tools.length === 0) {
  console.error(`[ERR] ${contractRel} 没有 tools`)
  process.exit(2)
}

const expected = projectManifest(tools)

if (opts.check) {
  if (!existsSync(manifestPath)) {
    console.error(`[ERR] MCP 清单不存在：${manifestRel}（先运行 project-mcp-tools.mjs）`)
    process.exit(1)
  }
  let actual
  try {
    actual = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.error(`[ERR] ${manifestRel} 不是合法 JSON：${error.message}`)
    process.exit(1)
  }
  const problems = diffManifests(expected, actual)
  if (problems.length > 0) {
    for (const p of problems) console.error(`[ERR] ${manifestRel}: ${p}`)
    console.error(`\n修复：node scripts/meta/project-mcp-tools.mjs`)
    process.exit(1)
  }
  console.log(`project-mcp-tools: 0 error(s); ${expected.tools.length} tools 与契约一致`)
  process.exit(0)
}

writeFileSync(manifestPath, stableStringify(expected))
console.log(`project-mcp-tools: 已写入 ${manifestRel}（${expected.tools.length} tools）`)
