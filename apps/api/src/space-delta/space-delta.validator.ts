import {
  type BoundedRepairResult,
  type SpaceDelta,
  type SpaceDeltaConflict,
  type SpaceDeltaOperation,
  type SpaceDeltaSecurityLevel,
  type SpaceDeltaValidation,
} from './space-delta.types'

const PROTOCOL = 'space-delta/v2'
const ALLOWED_ROOTS = new Set([
  'semantic',
  'pages',
  'menus',
  'permissions',
  'rules',
  'flows',
  'experience',
  'ui',
])
const FINAL_STRUCTURE = new Set([
  'manifest',
  'files',
  'compiled',
  'ir',
  'source',
  'package',
  'database',
  'db',
  'secrets',
  'env',
  'deploy',
])
const ALLOWED_OPS = new Set([
  'add',
  'update',
  'remove',
  'replace',
  'link',
  'unlink',
  'reorder',
])

/**
 * Space Delta 验证（5.4/5.5）。
 *
 * 只接受声明层路径（semantic/pages/menus/permissions/rules/flows/experience/ui）；
 * 最终结构（manifest/IR/source/DB/secrets）不可通过 Delta 直接写。
 * 返回结果错误顺序稳定，便于模型修复提示与快照测试。
 */
export function validateSpaceDelta(delta: unknown): SpaceDeltaValidation {
  const errors: string[] = []
  const warnings: string[] = []
  let securityLevel: SpaceDeltaSecurityLevel = 'L1'

  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    return {
      valid: false,
      errors: ['delta 必须是对象'],
      warnings: [],
      securityLevel: 'L3',
    }
  }
  const candidate = delta as Record<string, unknown>
  if (candidate.protocol !== PROTOCOL) {
    errors.push(`protocol 必须是 ${PROTOCOL}`)
  }
  if (typeof candidate.baseVersion !== 'string' || candidate.baseVersion.trim() === '') {
    errors.push('baseVersion 必须是非空字符串')
  }
  if (!Array.isArray(candidate.operations) || candidate.operations.length === 0) {
    errors.push('operations 必须是非空数组')
  }

  const operations = Array.isArray(candidate.operations)
    ? candidate.operations
    : []
  operations.forEach((raw, index) => {
    const prefix = `operations[${index}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${prefix} 必须是对象`)
      return
    }
    const operation = raw as Record<string, unknown>
    if (typeof operation.op !== 'string' || !ALLOWED_OPS.has(operation.op)) {
      errors.push(`${prefix}.op 非法`)
    }
    const path = typeof operation.path === 'string' ? operation.path : ''
    const pathCheck = validatePath(path)
    if (!pathCheck.valid) {
      errors.push(`${prefix}.path ${pathCheck.reason}`)
    } else {
      securityLevel = maxLevel(securityLevel, levelForPath(path))
    }
    if (
      (operation.op === 'add' ||
        operation.op === 'update' ||
        operation.op === 'replace') &&
      operation.value === undefined
    ) {
      errors.push(`${prefix}.value 必填`)
    }
    if (operation.op === 'link' || operation.op === 'unlink') {
      if (typeof operation.from !== 'string' || !operation.from) {
        errors.push(`${prefix}.from 必填`)
      }
      if (typeof operation.to !== 'string' || !operation.to) {
        errors.push(`${prefix}.to 必填`)
      }
      if (typeof operation.type !== 'string' || !operation.type) {
        errors.push(`${prefix}.type 必填`)
      }
    }
    if (operation.op === 'reorder' && !Array.isArray(operation.value)) {
      errors.push(`${prefix}.value 必须是数组`)
    }
  })

  if (errors.length > 0) securityLevel = 'L3'
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    securityLevel,
  }
}

export function assertSpaceDelta(delta: unknown): SpaceDelta {
  const result = validateSpaceDelta(delta)
  if (!result.valid) {
    throw new Error(`Space Delta 非法：${result.errors.join('; ')}`)
  }
  return delta as SpaceDelta
}

/**
 * 确定性冲突报告：按 path/op 稳定排序，不依赖输入顺序。
 */
export function detectSpaceDeltaConflicts(
  deltas: SpaceDelta[],
): SpaceDeltaConflict[] {
  const conflicts: SpaceDeltaConflict[] = []
  const baseVersions = new Set(deltas.map((delta) => delta.baseVersion))
  if (baseVersions.size > 1) {
    conflicts.push({
      code: 'base-version-mismatch',
      path: '/',
      operations: [],
      message: `同一批 Delta 基于不同版本：${[...baseVersions].sort().join(', ')}`,
    })
  }

  interface Entry {
    path: string
    op: string
    from?: string
    to?: string
    type?: string
    deltaIndex: number
    operationIndex: number
  }
  const entries: Entry[] = []
  deltas.forEach((delta, deltaIndex) => {
    delta.operations.forEach((operation, operationIndex) => {
      entries.push({
        path: operation.path,
        op: operation.op,
        from: operation.from,
        to: operation.to,
        type: operation.type,
        deltaIndex,
        operationIndex,
      })
    })
  })

  const byPath = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = byPath.get(entry.path) ?? []
    list.push(entry)
    byPath.set(entry.path, list)
  }

  for (const [path, list] of [...byPath.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const operations = list.map((entry) => entry.op)
    const indexOf = (entry: Entry): number =>
      entry.deltaIndex * 10_000 + entry.operationIndex
    const indices = list.map(indexOf).sort((a, b) => a - b)
    const addIndices = list
      .filter((entry) => entry.op === 'add')
      .map(indexOf)
      .sort((a, b) => a - b)
    const linkIndices = list
      .filter((entry) => entry.op === 'link' || entry.op === 'unlink')
      .map(indexOf)
      .sort((a, b) => a - b)
    if (operations.filter((op) => op === 'add').length > 1) {
      conflicts.push({
        code: 'duplicate-add',
        path,
        operations: addIndices,
        message: `${path} 存在重复 add`,
      })
    }
    if (
      operations.includes('remove') &&
      operations.some((op) => ['update', 'replace', 'link', 'unlink'].includes(op))
    ) {
      conflicts.push({
        code: 'remove-vs-mutate',
        path,
        operations: indices,
        message: `${path} 同时 remove 与修改操作`,
      })
    }
    const linkKeys = new Set(
      list
        .filter((entry) => entry.op === 'link' || entry.op === 'unlink')
        .map(
          (entry) =>
            `${entry.from ?? ''}|${entry.to ?? ''}|${entry.type ?? ''}`,
        ),
    )
    if (
      list.some((entry) => entry.op === 'link') &&
      list.some((entry) => entry.op === 'unlink') &&
      [...linkKeys].some((key) => {
        const [from, to, type] = key.split('|')
        return (
          list.some(
            (entry) =>
              entry.op === 'link' &&
              entry.from === from &&
              entry.to === to &&
              entry.type === type,
          ) &&
          list.some(
            (entry) =>
              entry.op === 'unlink' &&
              entry.from === from &&
              entry.to === to &&
              entry.type === type,
          )
        )
      })
    ) {
      conflicts.push({
        code: 'link-vs-unlink',
        path,
        operations: linkIndices,
        message: `${path} 对同一关系同时 link 与 unlink`,
      })
    }
    if (
      operations.filter((op) => op === 'add').length <= 1 &&
      new Set(operations).size !== operations.length &&
      operations.length > 1
    ) {
      conflicts.push({
        code: 'duplicate-operation',
        path,
        operations: indices,
        message: `${path} 存在重复操作`,
      })
    }
  }

  return conflicts.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.operations.join(',').localeCompare(right.operations.join(',')),
  )
}

/**
 * 有界修复：最多调用 repairer maxAttempts 次（上限 5），每次重新验证；
 * 超限返回最后一次错误，不无限重试、不静默接受非法 Delta。
 */
export async function boundedRepairSpaceDelta(input: {
  delta: unknown
  maxAttempts?: number
  repair: (
    errors: string[],
    attempt: number,
    current: unknown,
  ) => Promise<unknown> | unknown
}): Promise<BoundedRepairResult> {
  const maxAttempts = Math.max(1, Math.min(5, input.maxAttempts ?? 2))
  const first = validateSpaceDelta(input.delta)
  if (first.valid) {
    return {
      ok: true,
      delta: input.delta as SpaceDelta,
      errors: [],
      attempts: 0,
      history: [],
    }
  }
  let current = input.delta
  let errors = first.errors
  const history: Array<{ attempt: number; errors: string[] }> = []
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const repaired = await input.repair(errors, attempt, current)
    const validation = validateSpaceDelta(repaired)
    history.push({ attempt, errors: validation.errors })
    if (validation.valid) {
      return {
        ok: true,
        delta: repaired as SpaceDelta,
        errors: [],
        attempts: attempt,
        history,
      }
    }
    current = repaired
    errors = validation.errors
  }
  return {
    ok: false,
    errors,
    attempts: maxAttempts,
    history,
  }
}

function validatePath(path: string): { valid: boolean; reason: string } {
  if (!path || !path.startsWith('/')) {
    return { valid: false, reason: '必须以 / 开头' }
  }
  if (path.includes('..') || path.includes('//')) {
    return { valid: false, reason: '不允许 .. 或空路径段' }
  }
  const root = path.split('/')[1]
  if (FINAL_STRUCTURE.has(root)) {
    return { valid: false, reason: `不允许写最终结构 ${root}` }
  }
  if (!ALLOWED_ROOTS.has(root)) {
    return { valid: false, reason: `根命名空间 ${root} 不允许` }
  }
  return { valid: true, reason: '' }
}

function levelForPath(path: string): SpaceDeltaSecurityLevel {
  const root = path.split('/')[1]
  if (root === 'permissions' || root === 'rules') return 'L3'
  if (root === 'semantic' || root === 'flows') return 'L2'
  return 'L1'
}

function maxLevel(
  left: SpaceDeltaSecurityLevel,
  right: SpaceDeltaSecurityLevel,
): SpaceDeltaSecurityLevel {
  const rank = { L1: 1, L2: 2, L3: 3 }
  return rank[right] > rank[left] ? right : left
}
