#!/usr/bin/env node
/**
 * check-openspec-hygiene.mjs — OpenSpec 变更卫生检查。
 *
 * 1. stale path：in-progress change 引用的仓库路径不存在（旧 backend/src、speckit/ 必报）
 * 2. duplicate-added：ADDED Requirement 已存在于正式 spec
 * 3. cross-change-added：多个 change 对同一 capability 重复 ADDED 同名 Requirement
 * 4. superseded-open-task：标记 SUPERSEDED 的 change 仍有未完成任务
 *
 * 用法：
 *   node scripts/meta/check-openspec-hygiene.mjs
 *   node scripts/meta/check-openspec-hygiene.mjs --json
 *   node scripts/meta/check-openspec-hygiene.mjs --root <path>
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '../..')

const PATH_PREFIXES = [
  'apps/',
  'libs/',
  'docs/',
  'scripts/',
  'schemas/',
  'contracts/',
  'openspec/',
  'wasm-modules/',
  'crates/',
  'tools/',
  '.github/',
]
const STALE_ROOTS = ['backend/', 'speckit/']
const NEW_HINTS = [
  '待新增',
  '新增',
  '创建',
  'Create',
  'create',
  'ADDED',
  'new ',
  'TODO',
  '示例',
  'placeholder',
]

function read(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function isDir(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function listDirs(path) {
  if (!isDir(path)) return []
  return readdirSync(path)
    .filter((name) => !name.startsWith('.'))
    .map((name) => join(path, name))
    .filter(isDir)
}

function isSuperseded(proposal) {
  return /^>\s*Status:\s*SUPERSEDED/im.test(proposal)
}

function hasOpenTasks(tasks) {
  return /^\s*(?:[-*+]|\d+[.)])\s+\[ \]\s+/m.test(tasks)
}

function cleanToken(token) {
  return token
    .trim()
    .replace(/^\.\//, '')
    .replace(/:\d.*$/, '')
    .replace(/[，。；;]$/, '')
}

function shouldSkipToken(token, line) {
  if (!token) return true
  if (/[*{}<>|$]/.test(token)) return true
  if (token.includes('...')) return true
  if (token.startsWith('http')) return true
  if (token.startsWith('@')) return true
  if (token.startsWith('openspec/specs/')) return true
  if (token.includes('…')) return true
  if (token.includes('→') || token.includes('->')) return true
  if (token.includes('已删除')) return true
  if (token.includes('（待新增）') || token.includes('待新增') || token.includes('TODO')) return true
  if (NEW_HINTS.some((hint) => line.includes(hint))) return true
  return false
}

function checkStalePaths(root, changeDir) {
  const errors = []
  const files = ['proposal.md', 'tasks.md', 'design.md']
  for (const name of files) {
    const full = join(changeDir, name)
    const text = read(full)
    if (!text) continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const matches = [...line.matchAll(/`([^`\n]+)`/g)]
      for (const match of matches) {
        const token = cleanToken(match[1] ?? '')
        if (shouldSkipToken(token, line)) continue
        if (STALE_ROOTS.some((prefix) => token.startsWith(prefix))) {
          errors.push({
            code: 'stale-path',
            change: relative(root, changeDir).replaceAll('\\', '/'),
            file: `${relative(root, full).replaceAll('\\', '/')}:${i + 1}`,
            path: token,
            message: `旧路径 ${token} 已不存在`,
          })
          continue
        }
        if (!PATH_PREFIXES.some((prefix) => token.startsWith(prefix))) continue
        if (!existsSync(join(root, token))) {
          errors.push({
            code: 'stale-path',
            change: relative(root, changeDir).replaceAll('\\', '/'),
            file: `${relative(root, full).replaceAll('\\', '/')}:${i + 1}`,
            path: token,
            message: `路径 ${token} 不存在`,
          })
        }
      }
    }
  }
  return errors
}

function requirementNames(text, section) {
  const names = []
  let inSection = false
  for (const line of text.split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = new RegExp(`^##\\s+${section}\\s+Requirements`).test(line)
      continue
    }
    if (!inSection) continue
    const match = line.match(/^###\s+Requirement:\s*(.+)$/)
    if (match) names.push(match[1].trim())
  }
  return names
}

function existingRequirements(root, capability) {
  const text = read(join(root, 'openspec/specs', capability, 'spec.md'))
  return new Set([...text.matchAll(/^###\s+Requirement:\s*(.+)$/gm)].map((m) => m[1].trim()))
}

function checkSpecDeltas(root, changes) {
  const errors = []
  const addedByCapability = new Map()

  for (const change of changes) {
    if (change.superseded) continue
    const specDirs = listDirs(join(change.dir, 'specs'))
    for (const specDir of specDirs) {
      const capability = specDir.split('/').pop()
      const text = read(join(specDir, 'spec.md'))
      if (!text) continue

      const existing = existingRequirements(root, capability)
      for (const name of requirementNames(text, 'ADDED')) {
        if (existing.has(name)) {
          errors.push({
            code: 'duplicate-added',
            change: change.id,
            capability,
            requirement: name,
            message: `ADDED Requirement 已存在于 openspec/specs/${capability}/spec.md，应使用 MODIFIED`,
          })
        }
        const key = `${capability}::${name}`
        const owners = addedByCapability.get(key) ?? new Set()
        owners.add(change.id)
        addedByCapability.set(key, owners)
      }
    }
  }

  for (const [key, owners] of addedByCapability) {
    if (owners.size < 2) continue
    const [capability, requirement] = key.split('::')
    errors.push({
      code: 'cross-change-added',
      change: [...owners].sort().join(','),
      capability,
      requirement,
      message: `${owners.size} 个 change 同时对 ${capability} ADDED "${requirement}"`,
    })
  }

  return errors
}

function checkSuperseded(change) {
  if (!change.superseded) return []
  if (!hasOpenTasks(change.tasks)) return []
  return [
    {
      code: 'superseded-open-task',
      change: change.id,
      message: '已标记 SUPERSEDED，但仍存在未完成任务；应归档或标记任务为不适用',
    },
  ]
}

export function checkRepository(root = DEFAULT_ROOT) {
  const changesRoot = join(root, 'openspec/changes')
  if (!isDir(changesRoot)) {
    return { errors: [{ code: 'io', message: `找不到 ${changesRoot}` }], warnings: [] }
  }

  const changes = listDirs(changesRoot)
    .filter((dir) => dir.split('/').pop() !== 'archive')
    .map((dir) => {
      const proposal = read(join(dir, 'proposal.md'))
      const tasks = read(join(dir, 'tasks.md'))
      return {
        id: dir.split('/').pop(),
        dir,
        proposal,
        tasks,
        openTasks: hasOpenTasks(tasks),
        superseded: isSuperseded(proposal),
      }
    })
    .filter((change) => change.superseded || change.openTasks)

  const errors = []
  for (const change of changes) {
    errors.push(...checkSuperseded(change))
    if (!change.superseded) {
      errors.push(...checkStalePaths(root, change.dir))
    }
  }
  errors.push(...checkSpecDeltas(root, changes))

  return { errors, warnings: [] }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const warnOnly = argv.includes('--warn-only')
  const rootIndex = argv.indexOf('--root')
  const root =
    rootIndex >= 0 && argv[rootIndex + 1]
      ? resolve(argv[rootIndex + 1])
      : DEFAULT_ROOT

  const { errors, warnings } = checkRepository(root)

  if (json) {
    console.log(
      JSON.stringify(
        {
          check: 'check-openspec-hygiene',
          errors,
          warnings,
        },
        null,
        2,
      ),
    )
  } else {
    for (const error of errors) {
      const location = error.file ? ` (${error.file})` : ''
      console.error(`[ERR] ${error.code}: ${error.message}${location}`)
    }
    for (const warning of warnings) {
      console.error(`[WARN] ${warning.code}: ${warning.message}`)
    }
    console.log(
      `check-openspec-hygiene: ${errors.length} error(s), ${warnings.length} warning(s)`,
    )
  }

  process.exit(errors.length > 0 && !warnOnly ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
