import { createHash } from 'node:crypto'

export type ReleaseChannel = 'preview' | 'canary' | 'stable'
export type ReleaseStatus = 'building' | 'published' | 'superseded' | 'revoked' | 'failed'
export type ProposalStatus =
  | 'draft'
  | 'submitted'
  | 'validating'
  | 'validated'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'withdrawn'
export type ActivationStatus = 'scheduled' | 'active' | 'superseded' | 'rolled_back' | 'cancelled'

export interface Semver {
  major: number
  minor: number
  patch: number
  prerelease?: string
}

export function parseSemver(input: string): Semver {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(input.trim())
  if (!match) throw new Error(`非法 semver：${input}`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    ...(match[4] ? { prerelease: match[4] } : {}),
  }
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

export function isPrerelease(version: string): boolean {
  return Boolean(parseSemver(version).prerelease)
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    )
  }
  return value
}

export function computeReleaseDigest(manifest: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalize(manifest)).digest('hex')}`
}

const RELEASE_TRANSITIONS: Record<ReleaseStatus, readonly ReleaseStatus[]> = {
  building: ['published', 'failed'],
  published: ['superseded', 'revoked'],
  superseded: [],
  revoked: [],
  failed: [],
}

const PROPOSAL_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  draft: ['submitted'],
  submitted: ['validating'],
  validating: ['validated', 'draft'],
  validated: ['approved', 'rejected'],
  approved: ['published', 'withdrawn'],
  rejected: [],
  published: [],
  withdrawn: [],
}

const ACTIVATION_TRANSITIONS: Record<ActivationStatus, readonly ActivationStatus[]> = {
  scheduled: ['active', 'cancelled'],
  active: ['superseded', 'rolled_back'],
  superseded: [],
  rolled_back: [],
  cancelled: [],
}

export function canTransitionRelease(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return RELEASE_TRANSITIONS[from].includes(to)
}

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return PROPOSAL_TRANSITIONS[from].includes(to)
}

export function canTransitionActivation(from: ActivationStatus, to: ActivationStatus): boolean {
  return ACTIVATION_TRANSITIONS[from].includes(to)
}

export function assertTransition<T extends string>(kind: string, from: T, to: T, allowed: boolean): void {
  if (!allowed) throw new Error(`${kind} 状态不允许从 ${from} 迁移到 ${to}`)
}

export interface PublishCheckInput {
  version: string
  channel: ReleaseChannel
  manifest: unknown
  changelog: Record<string, unknown>
  compatibility?: { rollbackSafe?: boolean }
  migrations?: Array<{ id: string; rollbackSafe?: boolean }>
  authorId?: string | null
  approverId?: string | null
}

export function assertPublishable(input: PublishCheckInput): void {
  parseSemver(input.version)
  if (isPrerelease(input.version) && input.channel === 'stable') {
    throw new Error('预发布版本不能进入 stable 通道')
  }
  if (!input.manifest || typeof input.manifest !== 'object') {
    throw new Error('manifest 不能为空')
  }
  const changelog = input.changelog?.['zh-CN']
  if (!Array.isArray(changelog) || changelog.length === 0) {
    throw new Error('发布必须包含至少一条 zh-CN 业务 changelog')
  }
  const unsafeMigration = (input.migrations ?? []).some((item) => item.rollbackSafe === false)
  if (unsafeMigration && input.compatibility?.rollbackSafe !== true) {
    throw new Error('含不可回退迁移的 Release 必须标注 compatibility.rollbackSafe=true 或提供补偿迁移')
  }
  if (input.authorId && input.approverId && input.authorId === input.approverId) {
    throw new Error('作者不能批准/发布自己的提议')
  }
}

export interface ImpactItem {
  path: string
  change: 'added' | 'changed' | 'removed'
}

export function diffPlainObject(before: unknown, after: unknown, base = ''): ImpactItem[] {
  const out: ImpactItem[] = []
  const beforeObj = asRecord(before)
  const afterObj = asRecord(after)
  for (const key of new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])) {
    const path = `${base}/${key}`
    if (!(key in beforeObj)) out.push({ path, change: 'added' })
    else if (!(key in afterObj)) out.push({ path, change: 'removed' })
    else {
      const left = beforeObj[key]
      const right = afterObj[key]
      if (isRecord(left) && isRecord(right)) out.push(...diffPlainObject(left, right, path))
      else if (canonicalize(left) !== canonicalize(right)) out.push({ path, change: 'changed' })
    }
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
