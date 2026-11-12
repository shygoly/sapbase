import { SemanticRuntimeService, RecordWriteError } from './semantic-runtime.service'

describe('semantic asset fields', () => {
  const entity = {
    name: 'Course',
    fields: [{ name: 'cover', type: 'asset', assetKind: 'image' }],
  }
  const service = new SemanticRuntimeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      get: jest.fn(async (_org: string, id: string) => {
        if (id === 'missing') throw new Error('not found')
        if (id === 'wrong-kind') {
          return { id, kind: 'video', status: 'ready', mimeType: 'video/mp4', size: '1' }
        }
        if (id === 'not-ready') {
          return { id, kind: 'image', status: 'scanning', mimeType: 'image/png', size: '1' }
        }
        return {
          id,
          kind: 'image',
          status: 'ready',
          mimeType: 'image/png',
          size: '10',
          width: 100,
          height: 50,
          durationMs: null,
          pageCount: null,
        }
      }),
      downloadUrl: jest.fn(async () => ({ url: 'https://example.test/a.png?sig=1' })),
      signedVariantUrls: jest.fn(async () => [
        { kind: 'thumbnail', url: 'https://example.test/t.png', mimeType: 'image/jpeg', size: '2' },
      ]),
    } as never,
  )

  it('读取解析为摘要 + 签名 URL + variants', async () => {
    const row = { data: { cover: 'asset-1' } } as never
    const result = await (service as never as {
      resolveAssetFields: (row: never, entity: never, org: string) => Promise<never>
    }).resolveAssetFields(row, entity as never, 'org-1')
    expect((result as { data: Record<string, unknown> }).data.cover).toMatchObject({
      id: 'asset-1',
      kind: 'image',
      status: 'ready',
      width: 100,
      height: 50,
      url: 'https://example.test/a.png?sig=1',
      variants: [expect.objectContaining({ kind: 'thumbnail' })],
    })
  })

  it('缺失资产返回 missing，不抛 500', async () => {
    const row = { data: { cover: 'missing' } } as never
    const result = await (service as never as {
      resolveAssetFields: (row: never, entity: never, org: string) => Promise<never>
    }).resolveAssetFields(row, entity as never, 'org-1')
    expect((result as { data: Record<string, unknown> }).data.cover).toMatchObject({
      id: 'missing',
      status: 'missing',
      url: null,
    })
  })

  it('写入：跨组织/kind 不符/未 ready 拒绝', async () => {
    const assert = (service as never as {
      assertAssetFields: (
        entity: never,
        data: Record<string, unknown>,
        org: string,
      ) => Promise<void>
    }).assertAssetFields.bind(service)
    await expect(assert(entity as never, { cover: 'asset-1' }, 'org-1')).resolves.toBeUndefined()
    await expect(assert(entity as never, { cover: 'missing' }, 'org-1')).rejects.toBeInstanceOf(
      RecordWriteError,
    )
    await expect(
      assert(entity as never, { cover: 'wrong-kind' }, 'org-1'),
    ).rejects.toThrow(/类型不符/)
    await expect(assert(entity as never, { cover: 'not-ready' }, 'org-1')).rejects.toThrow(
      /不可引用/,
    )
  })
})
