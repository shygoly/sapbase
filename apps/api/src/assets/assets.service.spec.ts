import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AssetsService } from './assets.service'

function repo(rows: any[] = []) {
  const store = [...rows]
  const repository = {
    create: jest.fn((row) => ({ id: 'asset-id', ...row })),
    save: jest.fn(async (row) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    findOne: jest.fn(async ({ where }: any) =>
      store.find((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ),
    ),
    findAndCount: jest.fn(async () => [store, store.length]),
  }
  return { repository, store }
}

function storage() {
  return { signedUrl: jest.fn(async () => 'https://storage.example/signed') }
}

describe('AssetsService', () => {
  it('create → ready，size 存字符串', async () => {
    const { repository } = repo()
    const service = new AssetsService(repository as never, repository as never, storage() as never)
    const asset = await service.create('org-1', {
      objectKey: 'org/org-1/a.png',
      originalName: 'a.png',
      mimeType: 'image/png',
      size: 10,
      checksum: 'c1',
    })
    expect(asset).toMatchObject({ status: 'ready', size: '10', checksum: 'c1' })
  })

  it('get：跨组织/不存在 → 404', async () => {
    const { repository } = repo()
    const service = new AssetsService(repository as never, repository as never)
    await expect(service.get('org-1', 'missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('findDuplicate：同组织 checksum+size', async () => {
    const { repository } = repo([
      { id: 'a1', organizationId: 'org-1', checksum: 'c1', size: '10', status: 'ready' },
    ])
    const service = new AssetsService(repository as never, repository as never)
    await expect(service.findDuplicate('org-1', 'c1', 10)).resolves.toMatchObject({ id: 'a1' })
    await expect(service.findDuplicate('org-2', 'c1', 10)).resolves.toBeNull()
  })

  it('downloadUrl：ready 才签发；非 ready → 403', async () => {
    const { repository } = repo([
      { id: 'a1', organizationId: 'org-1', objectKey: 'org/org-1/a', status: 'ready' },
      { id: 'a2', organizationId: 'org-1', objectKey: 'org/org-1/b', status: 'quarantined' },
    ])
    const store = storage()
    const service = new AssetsService(repository as never, repository as never, store as never)
    await expect(service.downloadUrl('org-1', 'a1')).resolves.toMatchObject({
      url: 'https://storage.example/signed',
    })
    await expect(service.downloadUrl('org-1', 'a2')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('softDelete 幂等标记 deleted', async () => {
    const { repository } = repo([
      { id: 'a1', organizationId: 'org-1', status: 'ready', deletedAt: null },
    ])
    const service = new AssetsService(repository as never, repository as never)
    const asset = await service.softDelete('org-1', 'a1')
    expect(asset.status).toBe('deleted')
    expect(asset.deletedAt).toBeInstanceOf(Date)
  })
})
