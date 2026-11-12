import { BadRequestException, ConflictException } from '@nestjs/common'
import { AssetUploadService } from './asset-upload.service'

function repo(rows: any[] = []) {
  const store = [...rows]
  return {
    create: jest.fn((row) => ({ id: 'session-id', ...row })),
    save: jest.fn(async (row) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) => row.id === where.id && row.organizationId === where.organizationId,
      ) ?? null,
    ),
    count: jest.fn(async ({ where }: any) =>
      store.filter((row) => row.organizationId === where.organizationId && row.status === where.status)
        .length,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter((row) => row.organizationId === where.organizationId && row.status === where.status),
    ),
  }
}

function assets(existing: any = null) {
  return {
    findByObjectKey: jest.fn(async () => existing),
    create: jest.fn(async (_org, input) => ({ id: 'asset-1', ...input })),
    totalSize: jest.fn(async () => 0),
  }
}

function storage(head: any = { size: 5, checksum: 'c1' }) {
  return {
    signedUrl: jest.fn(async () => 'https://storage/upload'),
    head: jest.fn(async () => head),
  }
}

describe('AssetUploadService', () => {
  it('init：校验大小，生成 org 前缀 objectKey 与 upload URL', async () => {
    const sessions = repo()
    const service = new AssetUploadService(sessions as never, assets() as never, storage() as never)
    const { session, uploadUrl } = await service.init('org-1', 'u1', {
      originalName: 'a.png',
      mimeType: 'image/png',
      size: 5,
    })
    expect(session.objectKey).toMatch(/^org\/org-1\/uploads\//)
    expect(uploadUrl).toBe('https://storage/upload')
    await expect(
      service.init('org-1', 'u1', { originalName: 'x', mimeType: 'x', size: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recordPart：按 partNumber 覆盖并排序', async () => {
    const sessions = repo([
      { id: 's1', organizationId: 'org-1', status: 'uploading', parts: null },
    ])
    const service = new AssetUploadService(sessions as never, assets() as never, storage() as never)
    await service.recordPart('org-1', 's1', { partNumber: 2, etag: 'e2', size: 2 })
    const updated = await service.recordPart('org-1', 's1', { partNumber: 1, etag: 'e1', size: 1 })
    expect(updated.parts).toEqual([
      { partNumber: 1, etag: 'e1', size: 1 },
      { partNumber: 2, etag: 'e2', size: 2 },
    ])
  })

  it('complete：大小不符 → 400', async () => {
    const sessions = repo([
      {
        id: 's1',
        organizationId: 'org-1',
        objectKey: 'org/org-1/a',
        originalName: 'a',
        mimeType: 'image/png',
        expectedSize: '5',
        status: 'uploading',
        checksum: null,
        userId: 'u1',
      },
    ])
    const service = new AssetUploadService(
      sessions as never,
      assets() as never,
      storage({ size: 9 }) as never,
    )
    await expect(service.complete('org-1', 's1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('complete：成功建资产；重复 complete 幂等返回同一资产', async () => {
    const sessions = repo([
      {
        id: 's1',
        organizationId: 'org-1',
        objectKey: 'org/org-1/a',
        originalName: 'a',
        mimeType: 'image/png',
        expectedSize: '5',
        status: 'uploading',
        checksum: null,
        userId: 'u1',
      },
    ])
    const assetsService = assets(null)
    const service = new AssetUploadService(
      sessions as never,
      assetsService as never,
      storage({ size: 5, checksum: 'c1' }) as never,
    )
    const first = await service.complete('org-1', 's1')
    expect(first).toMatchObject({ assetId: 'asset-1', deduplicated: false })
    expect(assetsService.create).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ size: 5, objectKey: 'org/org-1/a' }),
    )
    assetsService.findByObjectKey.mockResolvedValue({ id: 'asset-1' })
    const second = await service.complete('org-1', 's1')
    expect(second).toMatchObject({ assetId: 'asset-1', deduplicated: true })
  })

  it('abort：已完成会话不能中止', async () => {
    const sessions = repo([
      { id: 's1', organizationId: 'org-1', status: 'completed' },
    ])
    const service = new AssetUploadService(sessions as never, assets() as never, storage() as never)
    await expect(service.abort('org-1', 's1')).rejects.toBeInstanceOf(ConflictException)
  })
})
