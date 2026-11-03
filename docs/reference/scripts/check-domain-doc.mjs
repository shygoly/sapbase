#!/usr/bin/env node
/**
 * check-domain-doc.mjs — 校验 DOMAIN.md 与 schema manifest / SQL / 代码的一致性。
 * 契约见 docs/reference/03-contracts.md。零依赖。
 *
 * 支持 schema.kind：
 *   - manifest: { tables: { name: { columns: [] } } } 或 { tables: [{ name, columns }] }
 *   - prisma:   解析 schema.prisma 的 model / @@map / @map
 *   - sql:      解析 CREATE TABLE（文件或目录）
 */
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import {
  cellsOf,
  createReporter,
  findFencedBlocks,
  findTable,
  findTables,
  loadConfig,
  loadSqlText,
  parseArgs,
  parsePathSymbol,
  parseSimpleYaml,
  pathFromRoot,
  printHelp,
  splitLines,
  stripQuotes,
  symbolExists,
  walkFiles,
} from './lib/common.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp('check-domain-doc.mjs', '校验 DOMAIN.md 覆盖矩阵、关系表与 invariant 块。')
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
const r = createReporter('check-domain-doc', ctx, opts)

function stripTick(value) {
  return String(value ?? '').trim().replace(/^`|`$/g, '')
}

function camelToSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

// ---------- schema ----------
function loadSchema() {
  const { kind, path } = ctx.config.schema
  const abs = pathFromRoot(ctx, path)
  if (!existsSync(abs)) {
    r.err(ctx.config.schema.path, 'schema 文件/目录不存在')
    return new Map()
  }
  if (kind === 'manifest') return loadManifest(abs)
  if (kind === 'prisma') return loadPrisma(abs)
  if (kind === 'sql') return loadSqlSchema(abs)
  r.err('meta.config.json', `schema.kind 未知：${kind}（允许 manifest | prisma | sql）`)
  return new Map()
}

function normalizeColumns(columns) {
  const out = new Set()
  for (const column of columns ?? []) {
    const name = typeof column === 'string' ? column : column?.name
    if (name) out.add(String(name))
  }
  return out
}

function loadManifest(abs) {
  let raw
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (error) {
    r.err(ctx.config.schema.path, `不是合法 JSON：${error.message}`)
    return new Map()
  }
  const tables = new Map()
  if (Array.isArray(raw?.tables)) {
    for (const table of raw.tables) {
      if (table?.name) tables.set(table.name, normalizeColumns(table.columns))
    }
  } else if (raw?.tables && typeof raw.tables === 'object') {
    for (const [name, def] of Object.entries(raw.tables)) {
      tables.set(name, normalizeColumns(def?.columns ?? def))
    }
  } else if (Array.isArray(raw)) {
    for (const table of raw) {
      if (table?.name) tables.set(table.name, normalizeColumns(table.columns))
    }
  }
  if (tables.size === 0) r.err(ctx.config.schema.path, 'manifest 没有 tables')
  return tables
}

function loadPrisma(abs) {
  const text = readFileSync(abs, 'utf8')
  const modelNames = new Set()
  for (const m of text.matchAll(/^model\s+(\w+)\s+\{/gm)) modelNames.add(m[1])
  const tables = new Map()
  for (const m of text.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
    const body = m[2]
    const map = body.match(/@@map\("([^"]+)"\)/)
    const tableName = map ? map[1] : camelToSnake(m[1])
    const columns = new Set()
    for (const line of body.split('\n')) {
      const field = line.match(/^\s{2}(\w+)\s+(\w+)/)
      if (!field) continue
      const [, name, type] = field
      if (modelNames.has(type)) continue
      const columnMap = line.match(/@map\("([^"]+)"\)/)
      columns.add(columnMap ? columnMap[1] : camelToSnake(name))
    }
    tables.set(tableName, columns)
  }
  return tables
}

function loadSqlSchema(abs) {
  const files = walkFiles(abs, { extensions: ['.sql'] })
  const tables = new Map()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?\w+"?\.)?"?(\w+)"?\s*\(([\s\S]*?)\)\s*;/gi)) {
      const table = m[1]
      const columns = new Set()
      for (const raw of m[2].split('\n')) {
        const line = raw.trim().replace(/,$/, '')
        if (!line) continue
        if (/^(constraint|primary\s+key|unique|foreign\s+key|check|exclude|like)\b/i.test(line)) continue
        const first = line.match(/^"?([A-Za-z_][\w]*)"?\s+/)
        if (first) columns.add(first[1])
      }
      tables.set(table, columns)
    }
  }
  if (tables.size === 0) r.err(ctx.config.schema.path, '没有解析到 CREATE TABLE')
  return tables
}

const schema = loadSchema()
const prefixes = ctx.config.schema.tablePrefixes ?? []
const scopedTables = prefixes.length
  ? new Set([...schema.keys()].filter((table) => prefixes.some((p) => table.startsWith(p))))
  : new Set(schema.keys())

// ---------- DOMAIN.md ----------
const domainPath = pathFromRoot(ctx, ctx.config.docs.domain)
if (!existsSync(domainPath)) {
  r.err(ctx.config.docs.domain, '文件不存在')
  r.finish(`tables ${scopedTables.size}`)
}
const lines = splitLines(readFileSync(domainPath, 'utf8'))

function sectionBase(title) {
  return String(title).replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
}

// 覆盖矩阵
const matrix = findTable(lines, ['表', '小节'])
const matrixMap = new Map()
if (!matrix) {
  r.err(ctx.config.docs.domain, '找不到覆盖矩阵（表头必须恰为 | 表 | 小节 |）')
} else {
  for (const row of matrix.rows) {
    const table = stripTick(row.cells[0])
    const section = stripTick(row.cells[1])
    if (!table || !section) {
      r.err(`${ctx.config.docs.domain}:${row.line}`, '覆盖矩阵行缺少表或小节')
      continue
    }
    if (matrixMap.has(table)) {
      r.err(`${ctx.config.docs.domain}:${row.line}`, `覆盖矩阵重复表：${table}`)
    }
    matrixMap.set(table, section)
  }
}

for (const table of [...scopedTables].sort()) {
  if (!matrixMap.has(table)) r.err(ctx.config.docs.domain, `覆盖矩阵缺表：${table}`)
}
for (const table of matrixMap.keys()) {
  if (!scopedTables.has(table)) r.err(ctx.config.docs.domain, `覆盖矩阵含未登记表：${table}`)
}

// 聚合小节与覆盖表
const headings = new Set()
const sectionTables = new Map()
let current = null
for (let i = 0; i < lines.length; i++) {
  const heading = lines[i].match(/^##\s+(.+)$/)
  if (heading) {
    const base = sectionBase(heading[1])
    current = /^(附录|覆盖矩阵)/.test(base) ? null : base
    if (current) headings.add(current)
    continue
  }
  const coverage = lines[i].match(/^覆盖表：\s*(.+)$/)
  if (!coverage || !current) continue
  const list = coverage[1].split(/[,，]/).map((s) => stripTick(s)).filter(Boolean)
  if (!sectionTables.has(current)) sectionTables.set(current, new Set())
  for (const table of list) {
    if (sectionTables.get(current).has(table)) {
      r.warn(`${ctx.config.docs.domain}:${i + 1}`, `小节「${current}」重复列覆盖表：${table}`)
    }
    sectionTables.get(current).add(table)
  }
}

for (const [section, tables] of sectionTables) {
  if (!headings.has(section)) r.err(ctx.config.docs.domain, `覆盖表引用了不存在的小节：${section}`)
  for (const table of tables) {
    const matrixSection = matrixMap.get(table)
    if (!matrixSection) {
      r.err(ctx.config.docs.domain, `小节「${section}」含未在覆盖矩阵登记的表：${table}`)
    } else if (sectionBase(matrixSection) !== section) {
      r.err(
        ctx.config.docs.domain,
        `表 ${table} 的覆盖矩阵小节「${matrixSection}」与覆盖表小节「${section}」不一致`,
      )
    }
  }
}
for (const table of matrixMap.keys()) {
  const section = sectionBase(matrixMap.get(table))
  if (!sectionTables.has(section) || !sectionTables.get(section).has(table)) {
    r.err(ctx.config.docs.domain, `覆盖矩阵的表 ${table} 没有在对应小节写「覆盖表：」`)
  }
}

// ---------- 关系表与 invariant ----------
const sqlText = loadSqlText(ctx)
let relationRows = 0
let invariantCount = 0

function checkDbToken(kind, name, location) {
  if (!name) {
    r.err(location, `${kind} 缺少约束名`)
    return
  }
  if (!sqlText.includes(name)) {
    if (ctx.config.schema.strictDbConstraints) {
      r.err(location, `SQL 中找不到约束：${kind}:${name}`)
    } else {
      r.warn(location, `SQL 中找不到约束：${kind}:${name}（若由 ORM 生成可忽略）`)
    }
  }
}

function checkEnforcement(tokens, location, { requireNoneReason = false } = {}) {
  const list = Array.isArray(tokens) ? tokens : (tokens ? [tokens] : [])
  if (list.length === 0) {
    r.err(location, 'enforcement 不能为空（允许 none，但要说明原因）')
    return
  }
  const hasNone = list.includes('none')
  if (hasNone && list.length > 1) {
    r.err(location, 'enforcement 里 none 不能与其他 token 并用')
  }
  for (const raw of list) {
    const token = String(raw).trim()
    if (!token) continue
    if (token === 'none') continue
    const colon = token.indexOf(':')
    if (colon < 0) {
      r.err(location, `未知 enforcement token：${token}`)
      continue
    }
    const kind = token.slice(0, colon)
    const value = token.slice(colon + 1)
    if (kind === 'db-fk' || kind === 'db-check' || kind === 'db-unique') {
      checkDbToken(kind, value, location)
      continue
    }
    if (kind === 'service' || kind === 'policy' || kind === 'test') {
      const { path, symbol } = parsePathSymbol(value)
      const abs = resolve(ctx.repoRoot, path)
      if (!existsSync(abs)) {
        r.err(location, `${kind} 路径不存在：${path}`)
        continue
      }
      if (!symbol) {
        r.err(location, `${kind} 必须写成 path#symbol：${value}`)
        continue
      }
      if (!symbolExists(abs, symbol)) {
        r.err(location, `${kind} 符号不存在：${value}`)
      }
      continue
    }
    if (kind === 'ui') {
      if (!existsSync(resolve(ctx.repoRoot, value))) {
        r.err(location, `ui 路径不存在：${value}`)
      }
      continue
    }
    r.err(location, `未知 enforcement 类型：${kind}（允许 db-fk/db-check/db-unique/service/policy/ui/test/none）`)
  }
  if (requireNoneReason && hasNone) {
    // 调用方负责检查备注；这里只做占位，避免误报。
  }
}

function checkColumnRef(ref, location, label) {
  const value = stripTick(ref)
  const idx = value.lastIndexOf('.')
  if (idx < 1) {
    r.err(location, `${label} 必须是 表名.列名：${value}`)
    return
  }
  const table = value.slice(0, idx)
  const column = value.slice(idx + 1)
  if (!schema.has(table)) {
    r.err(location, `${label} 表不存在：${table}`)
    return
  }
  if (!schema.get(table).has(column)) {
    r.err(location, `${label} 列不存在：${value}`)
  }
}

for (const table of findTables(lines, ['源列', '目标', '语义', '强制点', '备注'])) {
  for (const row of table.rows) {
    if (row.cells.length < 5) continue
    const [source, target, , enforcement, remark] = row.cells
    const location = `${ctx.config.docs.domain}:${row.line}`
    relationRows++
    checkColumnRef(source, location, '源列')
    const targetValue = stripTick(target)
    if (targetValue !== '-' && !targetValue.startsWith('dict:')) {
      checkColumnRef(targetValue, location, '目标')
    }
    const tokens = enforcement.split(',').map((s) => s.trim()).filter(Boolean)
    checkEnforcement(tokens, location)
    if (tokens.includes('none') && tokens.length === 1 && !remark.trim()) {
      r.err(location, `强制点 none 必须在备注说明原因`)
    }
  }
}

for (const block of findFencedBlocks(lines, 'yaml invariant')) {
  const fields = parseSimpleYaml(block.body)
  const location = `${ctx.config.docs.domain}:${block.startLine}`
  invariantCount++
  const id = fields.id
  if (!id || !/^INV-[A-Z0-9]+-(GAP-)?\d+$/.test(id)) {
    r.err(location, `invariant id 非法：${id ?? '(缺失)'}`)
    continue
  }
  const tables = Array.isArray(fields.tables) ? fields.tables : []
  if (tables.length === 0) r.err(location, `${id} 缺少 tables`)
  for (const table of tables) {
    if (!schema.has(stripTick(table))) r.err(location, `${id} 引用不存在的表：${table}`)
  }
  if (!fields.desc) r.err(location, `${id} 缺少 desc`)
  if (!fields.trigger) r.err(location, `${id} 缺少 trigger`)
  checkEnforcement(fields.enforcement, location)

  if (fields.db && fields.db !== 'none') {
    checkDbToken('db', fields.db, location)
  }
  if (fields.spec && fields.spec !== 'TODO') {
    if (!existsSync(resolve(ctx.repoRoot, fields.spec))) {
      r.err(location, `${id} 的 spec 不存在：${fields.spec}`)
    }
  } else if (fields.spec === 'TODO') {
    r.warn(location, `${id} 的 spec 还是 TODO（GAP 可接受，需写偿还条件）`)
  } else {
    r.warn(location, `${id} 缺少 spec`)
  }
}

r.finish(`tables ${scopedTables.size}, relations ${relationRows}, invariants ${invariantCount}`)
