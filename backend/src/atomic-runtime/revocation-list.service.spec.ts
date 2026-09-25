import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  RevocationListService,
  parseRevocationList,
} from './revocation-list.service'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function entry(sha256: string) {
  return {
    sha256,
    reason: 'security-incident',
    revokedAt: '2026-09-25T00:00:00.000Z',
    revokedBy: 'security@test',
  }
}

describe('parseRevocationList', () => {
  it('接受合法名单并规范化哈希大小写', () => {
    const list = parseRevocationList({
      version: 2,
      issuedAt: '2026-09-25T00:00:00.000Z',
      revoked: [entry(HASH_A.toUpperCase())],
    })
    expect(list.version).toBe(2)
    expect(list.revoked[0].sha256).toBe(HASH_A)
  })

  it.each([
    ['不是对象', 'nope'],
    ['缺 version', { revoked: [] }],
    ['revoked 不是数组', { version: 1, revoked: 'x' }],
    ['哈希非法', { version: 1, revoked: [{ ...entry(HASH_A), sha256: 'zz' }] }],
    ['reason 非法', { version: 1, revoked: [{ ...entry(HASH_A), reason: 'made-up' }] }],
    ['缺 revokedBy', { version: 1, revoked: [{ ...entry(HASH_A), revokedBy: undefined }] }],
  ])('拒绝：%s（解析不动一律拒）', (_label, raw) => {
    expect(() => parseRevocationList(raw)).toThrow()
  })
})

describe('RevocationListService', () => {
  it('文件不存在 → 空名单且标记未载入', () => {
    const service = new RevocationListService('/nonexistent/revocations.json')
    const state = service.refresh()
    expect(state.list.revoked).toEqual([])
    expect(state.loaded).toBe(false)
    expect(state.lastError).toContain('不存在')
  })

  it('载入合法名单并生效', () => {
    const dir = mkdtempSync(join(tmpdir(), 'speckit-revocation-'))
    try {
      const path = join(dir, 'revocations.json')
      writeFileSync(path, JSON.stringify({ version: 3, revoked: [entry(HASH_A)] }))
      const service = new RevocationListService(path)
      const state = service.refresh()
      expect(state.loaded).toBe(true)
      expect(state.list.version).toBe(3)
      expect(state.list.revoked[0].sha256).toBe(HASH_A)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('版本更低的名单被忽略（防回放）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'speckit-revocation-'))
    try {
      const path = join(dir, 'revocations.json')
      writeFileSync(path, JSON.stringify({ version: 5, revoked: [entry(HASH_A)] }))
      const service = new RevocationListService(path)
      service.refresh()

      // 攻击者把旧名单放回去：版本 2，且不含 A 的吊销
      writeFileSync(path, JSON.stringify({ version: 2, revoked: [entry(HASH_B)] }))
      const state = service.refresh()

      expect(state.list.version).toBe(5)
      expect(state.list.revoked.map((r) => r.sha256)).toEqual([HASH_A])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('形状非法的名单不生效，且保留上一次已知良好的名单', () => {
    const dir = mkdtempSync(join(tmpdir(), 'speckit-revocation-'))
    try {
      const path = join(dir, 'revocations.json')
      writeFileSync(path, JSON.stringify({ version: 4, revoked: [entry(HASH_A)] }))
      const service = new RevocationListService(path)
      service.refresh()

      writeFileSync(path, '{ not json')
      const state = service.refresh()

      expect(state.list.version).toBe(4)
      expect(state.list.revoked).toHaveLength(1)
      expect(state.lastError).toBeTruthy()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
