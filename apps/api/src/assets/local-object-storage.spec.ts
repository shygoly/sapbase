import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalObjectStorage } from './local-object-storage'
import { ObjectStorageError } from './object-storage'

describe('LocalObjectStorage', () => {
  let root: string
  let storage: LocalObjectStorage

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sap-assets-'))
    storage = new LocalObjectStorage({ rootDir: root })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('put/get/head/delete 往返', async () => {
    const body = Buffer.from('hello')
    const stored = await storage.put('org/org-1/a.txt', body, { contentType: 'text/plain' })
    expect(stored).toMatchObject({ key: 'org/org-1/a.txt', size: 5 })
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/)
    await expect(storage.get('org/org-1/a.txt')).resolves.toEqual(body)
    await expect(storage.head('org/org-1/a.txt')).resolves.toMatchObject({ size: 5 })
    await storage.delete('org/org-1/a.txt')
    await expect(storage.head('org/org-1/a.txt')).resolves.toBeNull()
    await expect(storage.get('org/org-1/a.txt')).rejects.toBeInstanceOf(ObjectStorageError)
  })

  it('拒绝路径穿越/绝对路径/反斜杠', async () => {
    for (const key of ['../etc/passwd', '/etc/passwd', 'org\\org-1\\a.txt', 'org//a.txt', 'org/./a.txt']) {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toBeInstanceOf(ObjectStorageError)
    }
  })

  it('signedUrl 带操作与过期时间；非法 key 拒绝', async () => {
    const url = await storage.signedUrl('org/org-1/a.txt', 'read', 60)
    expect(url).toContain('/local-storage/')
    expect(url).toContain('op=read')
    expect(url).toContain('expires=')
    await expect(storage.signedUrl('../x', 'read', 60)).rejects.toBeInstanceOf(
      ObjectStorageError,
    )
  })

  it('删除不存在对象是幂等 no-op', async () => {
    await expect(storage.delete('org/org-1/missing.txt')).resolves.toBeUndefined()
  })
})
