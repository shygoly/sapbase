// 共享工具：零依赖，Node 18+。
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    config: 'meta.config.json',
    warnOnly: false,
    json: false,
    baseline: null,
    updateBaseline: false,
    help: false,
    _: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') out.config = argv[++i]
    else if (a === '--warn-only') out.warnOnly = true
    else if (a === '--json') out.json = true
    else if (a === '--baseline') out.baseline = argv[++i]
    else if (a === '--update-baseline') out.updateBaseline = true
    else if (a === '--root') out.root = argv[++i]
    else if (a === '--out') out.out = argv[++i]
    else if (a.startsWith('--root=')) out.root = a.slice('--root='.length)
    else if (a.startsWith('--out=')) out.out = a.slice('--out='.length)
    else if (a === '--help' || a === '-h') out.help = true
    else out._.push(a)
  }
  return out
}

const DEFAULTS = {
  docs: {
    domain: 'DOMAIN.md',
    flows: 'FLOWS.md',
    decisions: 'DECISIONS.md',
    agentTools: 'AGENT-TOOLS.md',
  },
  code: {
    roots: ['apps', 'libs', 'backend/src', 'speckit/src'],
    extensions: ['.ts', '.tsx', '.js', '.mjs'],
    ignoreDirs: ['node_modules', '.next', 'dist', 'coverage', '.nx', '.git'],
  },
  schema: {
    kind: 'manifest',
    path: 'contracts/schema-manifest.json',
    tablePrefixes: ['biz_', 'app_', 'agent_', 'sys_'],
  },
  cron: {
    registry: 'apps/api/src/monitor/scheduled-job.registry.ts',
    decoratorPatterns: ["@Cron\\([^)]*name:\\s*['\"]([^'\"]+)['\"]"],
  },
  agentTools: {
    contract: 'contracts/tools.json',
    handlerRoots: ['libs/agent-tools/src', 'backend/src/agent-tools'],
    handlerPattern: "(?:toolName\\s*:\\s*|case\\s+)['\"]([^'\"]+)['\"]",
    strictHandlers: false,
  },
  sqlDirs: ['sql', 'tools/postgres/init', 'backend/src/migrations'],
}

function merge(base, override) {
  if (Array.isArray(override)) return override
  if (override && typeof override === 'object') {
    const out = { ...base }
    for (const [k, v] of Object.entries(override)) {
      out[k] = k in base ? merge(base[k], v) : v
    }
    return out
  }
  return override === undefined ? base : override
}

export function loadConfig(configPath) {
  const abs = resolve(configPath)
  if (!existsSync(abs)) {
    throw new Error(
      `缺少 ${configPath}。复制 docs/reference/scripts/meta.config.example.json 到仓库根，按项目改路径。`,
    )
  }
  let raw
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (error) {
    throw new Error(`${configPath} 不是合法 JSON：${error.message}`)
  }
  return { config: merge(DEFAULTS, raw), configPath: abs, repoRoot: dirname(abs) }
}

export function pathFromRoot(ctx, p) {
  return resolve(ctx.repoRoot, p)
}

export function readText(path, { optional = false } = {}) {
  if (!existsSync(path)) {
    if (optional) return null
    throw new Error(`文件不存在：${path}`)
  }
  return readFileSync(path, 'utf8')
}

export function splitLines(text) {
  return text.split(/\r?\n/)
}

export function cellsOf(line) {
  const t = line.trim()
  if (!t.startsWith('|')) return []
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
}

export function findTable(lines, headerCells) {
  const target = headerCells.map((s) => s.trim())
  for (let i = 0; i < lines.length - 1; i++) {
    const cells = cellsOf(lines[i])
    if (cells.length !== target.length) continue
    if (!cells.every((c, j) => c === target[j])) continue
    const rows = []
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      rows.push({ line: j + 1, cells: cellsOf(lines[j]) })
    }
    return { headerLine: i + 1, rows }
  }
  return null
}

export function findTables(lines, headerCells) {
  const target = headerCells.map((s) => s.trim())
  const out = []
  for (let i = 0; i < lines.length - 1; i++) {
    const cells = cellsOf(lines[i])
    if (cells.length !== target.length) continue
    if (!cells.every((c, j) => c === target[j])) continue
    const rows = []
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      rows.push({ line: j + 1, cells: cellsOf(lines[j]) })
    }
    out.push({ headerLine: i + 1, rows })
  }
  return out
}

export function findFencedBlocks(lines, info) {
  const out = []
  const fence = '```' + info
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== fence) continue
    const startLine = i + 1
    const body = []
    let j = i + 1
    for (; j < lines.length && lines[j].trim() !== '```'; j++) body.push(lines[j])
    out.push({ startLine, body, endLine: j + 1 })
    i = j
  }
  return out
}

export function stripQuotes(value) {
  const s = String(value ?? '').trim()
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1)
  }
  return s
}

export function splitInlineArray(value) {
  const s = String(value ?? '').trim()
  if (!s.startsWith('[') || !s.endsWith(']')) return []
  const inner = s.slice(1, -1)
  const out = []
  let cur = ''
  let quote = null
  for (const ch of inner) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === ',') {
      const item = stripQuotes(cur.trim())
      if (item) out.push(item)
      cur = ''
    } else {
      cur += ch
    }
  }
  const last = stripQuotes(cur.trim())
  if (last) out.push(last)
  return out
}

export function parseSimpleYaml(lines) {
  const obj = {}
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const m = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()

    if (value === '|' || value === '>') {
      const buf = []
      let j = i + 1
      while (j < lines.length) {
        const line = lines[j]
        if (line.trim() === '') {
          buf.push('')
          j++
          continue
        }
        if (/^\s+/.test(line)) {
          buf.push(line.replace(/^\s{2}/, ''))
          j++
          continue
        }
        break
      }
      obj[key] = buf.join('\n').trim()
      i = j - 1
      continue
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      obj[key] = splitInlineArray(value)
      continue
    }

    if (value === '') {
      const arr = []
      let j = i + 1
      while (j < lines.length) {
        const line = lines[j]
        if (line.trim() === '') {
          j++
          continue
        }
        const item = line.match(/^\s+-\s+(.*)$/)
        if (item) {
          arr.push(stripQuotes(item[1].trim()))
          j++
          continue
        }
        break
      }
      if (arr.length > 0) {
        obj[key] = arr
        i = j - 1
        continue
      }
      obj[key] = ''
      continue
    }

    obj[key] = stripQuotes(value)
  }
  return obj
}

export function walkFiles(root, { extensions = null, ignoreDirs = [] } = {}) {
  const out = []
  if (!existsSync(root)) return out
  const st = statSync(root)
  if (st.isFile()) {
    if (!extensions || extensions.includes(extname(root))) out.push(root)
    return out
  }
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) stack.push(full)
      } else if (entry.isFile()) {
        if (!extensions || extensions.includes(extname(entry.name))) out.push(full)
      }
    }
  }
  return out.sort()
}

export function rel(ctx, p) {
  return p.startsWith(ctx.repoRoot + '/') ? p.slice(ctx.repoRoot.length + 1) : p
}

export function symbolExists(file, symbol) {
  if (!existsSync(file)) return false
  const text = readFileSync(file, 'utf8')
  return text.includes(symbol)
}

export function parsePathSymbol(token) {
  const idx = token.indexOf('#')
  if (idx < 0) return { path: token, symbol: null }
  return { path: token.slice(0, idx), symbol: token.slice(idx + 1) }
}

export function loadSqlText(ctx) {
  let text = ''
  for (const dir of ctx.config.sqlDirs ?? []) {
    for (const file of walkFiles(pathFromRoot(ctx, dir), { extensions: ['.sql'] })) {
      text += '\n' + readFileSync(file, 'utf8')
    }
  }
  return text
}

export function setDiff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort()
}

export function createReporter(name, ctx, opts) {
  const errors = []
  const warnings = []
  const baseline = loadBaseline(ctx, opts)

  function isBaselined(text) {
    return baseline.some((entry) => text.includes(entry))
  }

  function err(location, message) {
    const text = `[ERR] ${location}: ${message}`
    if (isBaselined(text)) {
      warnings.push(`[WARN][baseline] ${location}: ${message}`)
    } else {
      errors.push(text)
    }
  }

  function warn(location, message) {
    const text = `[WARN] ${location}: ${message}`
    if (isBaselined(text)) return
    warnings.push(text)
  }

  function finish(summary) {
    if (opts.updateBaseline && opts.baseline) {
      const path = resolve(ctx.repoRoot, opts.baseline)
      writeFileSync(path, JSON.stringify([...errors].sort(), null, 2) + '\n')
      console.log(`已写入基线：${path}（${errors.length} 条）`)
    }

    if (opts.json) {
      console.log(JSON.stringify({ check: name, errors, warnings, summary }, null, 2))
    } else {
      for (const w of warnings) console.warn(w)
      for (const e of errors) console.error(e)
      console.log(`\n${name}: ${errors.length} error(s), ${warnings.length} warning(s); ${summary}`)
    }
    process.exit(errors.length > 0 && !opts.warnOnly && !opts.updateBaseline ? 1 : 0)
  }

  return { err, warn, finish, errors, warnings }
}

function loadBaseline(ctx, opts) {
  if (!opts.baseline) return []
  const path = resolve(ctx.repoRoot, opts.baseline)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    if (Array.isArray(raw)) return raw
    return []
  } catch {
    return []
  }
}

export function printHelp(name, extra = '') {
  console.log(`用法：node ${name} [--config meta.config.json] [--warn-only] [--json] [--baseline meta-baseline.json] [--update-baseline]`)
  if (extra) console.log(extra)
}
