#!/usr/bin/env node
/**
 * openspec-ledger.mjs — 生成 / 校验 OpenSpec change 台账。
 *
 * 数据源是仓库文件本身（不依赖全局 openspec CLI）：
 *   - openspec/changes/<id>/proposal.md / design.md / specs/** / tasks.md
 *   - openspec/changes/archive/<YYYY-MM-DD>-<id>/
 *
 * 用法：
 *   node scripts/meta/openspec-ledger.mjs                 # 生成 docs/OPENSPEC_CHANGES.md
 *   node scripts/meta/openspec-ledger.mjs --check         # 台账过期则退出 1
 *   node scripts/meta/openspec-ledger.mjs --json          # 输出机器可读数据
 *   node scripts/meta/openspec-ledger.mjs --out <path>    # 自定义输出
 *   node scripts/meta/openspec-ledger.mjs --root <path>   # 自定义仓库根
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'

const DEFAULT_OUT = 'docs/OPENSPEC_CHANGES.md'

function parseArgs(argv = process.argv.slice(2)) {
  const out = { root: process.cwd(), out: DEFAULT_OUT, check: false, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') out.root = argv[++i]
    else if (a.startsWith('--root=')) out.root = a.slice('--root='.length)
    else if (a === '--out') out.out = argv[++i]
    else if (a.startsWith('--out=')) out.out = a.slice('--out='.length)
    else if (a === '--check') out.check = true
    else if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`未知参数：${a}`)
  }
  return out
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function listDirectories(path) {
  if (!isDirectory(path)) return []
  return readdirSync(path)
    .filter((name) => !name.startsWith('.'))
    .map((name) => join(path, name))
    .filter(isDirectory)
}

function walkFiles(dir) {
  const out = []
  if (!isDirectory(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walkFiles(full))
    else out.push(full)
  }
  return out
}

function countTasks(text) {
  if (!text) return { total: 0, completed: 0 }
  const re = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+/gm
  let total = 0
  let completed = 0
  let match
  while ((match = re.exec(text))) {
    total += 1
    if (match[1].toLowerCase() === 'x') completed += 1
  }
  return { total, completed }
}

function firstHeading(text, fallback) {
  if (!text) return fallback
  const m = text.match(/^#\s+(.+?)\s*$/m)
  if (!m) return fallback
  return m[1].replace(/^Change:\s*/i, '').trim() || fallback
}

function specStats(changeDir) {
  const specDir = join(changeDir, 'specs')
  const files = walkFiles(specDir).filter((file) => file.endsWith('.md'))
  let requirements = 0
  let deltas = 0
  for (const file of files) {
    const text = readText(file) ?? ''
    requirements += (text.match(/^###\s+Requirement:/gm) ?? []).length
    deltas += (text.match(/^##\s+(?:ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/gm) ?? []).length
  }
  return { files: files.length, requirements, deltas }
}

function maxMtime(dir) {
  let max = 0
  for (const file of walkFiles(dir)) {
    try {
      max = Math.max(max, statSync(file).mtimeMs)
    } catch {
      // ignore
    }
  }
  return max
}

function utcDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toISOString().slice(0, 10)
}

function archiveDateOf(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})-/)
  return m ? m[1] : null
}

/**
 * “最近更新”优先取 git 提交日期：文件 mtime 在 CI checkout 后不可靠。
 * 未提交的新 change 回退到文件 mtime（UTC 日期）。
 */
function lastModifiedDate(root, dir) {
  const rel = relative(root, dir).replaceAll('\\', '/')
  const result = spawnSync('git', ['log', '-1', '--format=%cs', '--', rel], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status === 0) {
    const date = (result.stdout || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  }
  return utcDate(maxMtime(dir))
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function truncate(value, max = 80) {
  const s = String(value ?? '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function linkFrom(outDir, target) {
  const rel = relative(outDir, target).replaceAll('\\', '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function entryLinks(outDir, changeDir) {
  const links = []
  for (const [label, file] of [
    ['P', 'proposal.md'],
    ['D', 'design.md'],
    ['T', 'tasks.md'],
  ]) {
    const full = join(changeDir, file)
    if (existsSync(full)) links.push(`[${label}](${linkFrom(outDir, full)})`)
  }
  const specDir = join(changeDir, 'specs')
  if (isDirectory(specDir)) links.push(`[S](${linkFrom(outDir, specDir)})`)
  return links.length > 0 ? links.join(' ') : '—'
}

function changeInfo(root, changeDir, outDir, archived, archiveName) {
  const id = archived ? archiveName.replace(/^\d{4}-\d{2}-\d{2}-/, '') : archiveName
  const proposal = readText(join(changeDir, 'proposal.md'))
  const design = readText(join(changeDir, 'design.md'))
  const tasks = readText(join(changeDir, 'tasks.md'))
  const taskStats = countTasks(tasks)
  const specs = specStats(changeDir)
  const title = firstHeading(proposal, firstHeading(design, id))
  const lastModified = archived
    ? archiveDateOf(archiveName) ?? lastModifiedDate(root, changeDir)
    : lastModifiedDate(root, changeDir)
  const archiveDate = archived ? lastModified : null

  let status
  if (archived) status = 'archived'
  else if (taskStats.total === 0) status = proposal ? 'no-tasks' : 'scaffold'
  else if (taskStats.completed === taskStats.total) status = 'complete'
  else status = 'in-progress'

  return {
    id,
    title: truncate(title),
    archived,
    archiveDate,
    status,
    taskTotal: taskStats.total,
    taskCompleted: taskStats.completed,
    specFiles: specs.files,
    specRequirements: specs.requirements,
    specDeltas: specs.deltas,
    lastModified,
    dir: changeDir,
    links: entryLinks(outDir, changeDir),
  }
}

function collect(root, outDir) {
  const changesDir = join(root, 'openspec', 'changes')
  const archiveDir = join(changesDir, 'archive')
  if (!isDirectory(changesDir)) {
    throw new Error(`找不到 ${relative(root, changesDir)}`)
  }

  const active = listDirectories(changesDir)
    .filter((dir) => dir !== archiveDir)
    .map((dir) => changeInfo(root, dir, outDir, false, dir.split('/').at(-1)))
    .sort((a, b) => {
      const rank = { 'in-progress': 0, complete: 1, 'no-tasks': 2, scaffold: 3 }
      const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
      if (byStatus !== 0) return byStatus
      return b.lastModified.localeCompare(a.lastModified) || a.id.localeCompare(b.id)
    })

  const archived = listDirectories(archiveDir)
    .map((dir) => {
      const name = dir.split('/').at(-1)
      return changeInfo(root, dir, outDir, true, name)
    })
    .sort((a, b) => {
      const byDate = (b.archiveDate ?? '').localeCompare(a.archiveDate ?? '')
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
    })

  return { active, archived }
}

function taskCell(change) {
  if (change.taskTotal === 0) return '—'
  return `${change.taskCompleted}/${change.taskTotal}`
}

function specCell(change) {
  if (change.specFiles === 0) return '—'
  return `${change.specRequirements} req / ${change.specFiles} 文件`
}

function row(outDir, change) {
  const dirLink = `[${change.id}](${linkFrom(outDir, change.dir)}/)`
  const updated = change.archived ? change.archiveDate ?? '—' : change.lastModified
  return `| ${dirLink} | ${escapeCell(change.title)} | ${taskCell(change)} | ${specCell(change)} | ${change.links} | ${updated} |`
}

function renderMarkdown(data, outDir) {
  const inProgress = data.active.filter((c) => c.status === 'in-progress')
  const complete = data.active.filter((c) => c.status === 'complete')
  const noTasks = data.active.filter((c) => c.status === 'no-tasks' || c.status === 'scaffold')
  const activeTasks = data.active.reduce(
    (acc, c) => {
      acc.completed += c.taskCompleted
      acc.total += c.taskTotal
      return acc
    },
    { completed: 0, total: 0 },
  )

  const lines = [
    '# OpenSpec Changes Ledger',
    '',
    '> 自动生成，请勿手改。更新：`npm run meta:openspec-ledger`；校验：`npm run check:openspec-ledger`。',
    '> 数据源：`openspec/changes/**` 与 `openspec/changes/archive/**`；任务数来自 `tasks.md` 复选框。',
    '',
    '## 摘要',
    '',
    '| 指标 | 数量 |',
    '| --- | --- |',
    `| 进行中 | ${inProgress.length} |`,
    `| 已完成未归档 | ${complete.length} |`,
    `| 无任务/骨架 | ${noTasks.length} |`,
    `| 已归档 | ${data.archived.length} |`,
    `| 活跃任务 | ${activeTasks.completed}/${activeTasks.total} |`,
    '',
    '> “完成”只表示 `tasks.md` 复选框全部勾选；归档状态以 `openspec/changes/archive/` 为准。',
    '',
  ]

  const sections = [
    ['进行中', inProgress],
    ['已完成未归档', complete],
    ['无任务/骨架', noTasks],
    ['已归档', data.archived],
  ]

  for (const [title, items] of sections) {
    lines.push(`## ${title}`, '')
    if (items.length === 0) {
      lines.push('_暂无_', '')
      continue
    }
    lines.push(
      '| Change | 标题 | 任务 | 规格 | 入口 | 最近更新 |',
      '| --- | --- | --- | --- | --- | --- |',
      ...items.map((change) => row(outDir, change)),
      '',
    )
  }

  lines.push(
    '## 说明',
    '',
    '- 入口：`P` proposal、`D` design、`T` tasks、`S` specs。',
    '- 任务进度来自 `tasks.md` 的 `- [ ]` / `- [x]`；`—` 表示没有任务清单。',
    '- `openspec status --change <id>` 只表示产物是否齐全，不代表任务已实现；本台账以任务复选框为准。',
    '- 归档 change 的“最近更新”列显示归档日期（来自目录名前缀）。',
    '',
  )

  return lines.join('\n')
}

function main() {
  const opts = parseArgs()
  if (opts.help) {
    console.log(`用法：node scripts/meta/openspec-ledger.mjs [--root <path>] [--out <path>] [--check] [--json]`)
    return
  }

  const root = resolve(opts.root)
  const outPath = resolve(root, opts.out)
  const outDir = dirname(outPath)
  const data = collect(root, outDir)
  const markdown = renderMarkdown(data, outDir)

  const summary = {
    active: data.active.length,
    inProgress: data.active.filter((c) => c.status === 'in-progress').length,
    complete: data.active.filter((c) => c.status === 'complete').length,
    noTasks: data.active.filter((c) => c.status === 'no-tasks' || c.status === 'scaffold').length,
    archived: data.archived.length,
    tasks: data.active.reduce(
      (acc, c) => {
        acc.completed += c.taskCompleted
        acc.total += c.taskTotal
        return acc
      },
      { completed: 0, total: 0 },
    ),
  }

  if (opts.json) {
    console.log(JSON.stringify({ generatedFrom: root, outPath, summary, changes: data.active, archived: data.archived }, null, 2))
    return
  }

  if (opts.check) {
    const current = readText(outPath)
    if (current === null) {
      console.error(`[ERR] 台账不存在：${relative(root, outPath)}`)
      console.error('修复：npm run meta:openspec-ledger')
      process.exit(1)
    }
    if (current !== markdown) {
      console.error(`[ERR] 台账过期：${relative(root, outPath)}`)
      console.error('修复：npm run meta:openspec-ledger')
      const currentLines = current.split('\n')
      const nextLines = markdown.split('\n')
      let shown = 0
      for (let i = 0; i < Math.max(currentLines.length, nextLines.length) && shown < 8; i++) {
        if (currentLines[i] !== nextLines[i]) {
          console.error(`  line ${i + 1}:`)
          console.error(`    - ${currentLines[i] ?? '(missing)'}`)
          console.error(`    + ${nextLines[i] ?? '(missing)'}`)
          shown += 1
        }
      }
      process.exit(1)
    }
    console.log(`[OK] 台账已最新：${relative(root, outPath)}`)
    return
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, markdown)
  console.log(`已生成 ${relative(root, outPath)}`)
  console.log(
    `进行中 ${summary.inProgress}，已完成未归档 ${summary.complete}，无任务 ${summary.noTasks}，已归档 ${summary.archived}；任务 ${summary.tasks.completed}/${summary.tasks.total}`,
  )
}

main()
