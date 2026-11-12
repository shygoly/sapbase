import { AssetProcessorError, AssetProcessorRegistry } from './asset-processor'
import { AssetProcessingService } from './asset-processing.service'

function setup(result: any = { status: 'ready' }) {
  const asset = {
    id: 'a1',
    organizationId: 'org-1',
    kind: 'image',
    status: 'uploading',
    metadata: null,
  }
  const repo = {
    findOne: jest.fn(async () => asset),
    save: jest.fn(async (row) => row),
  }
  const assets = {
    get: jest.fn(async () => asset),
    save: repo.save,
    addVariant: jest.fn(async () => ({})),
  }
  const registry = new AssetProcessorRegistry()
  registry.register({
    name: 'image',
    kinds: ['image'],
    process: jest.fn(async () => result),
  })
  return {
    service: new AssetProcessingService(repo as never, registry, assets as never),
    asset,
    assets,
  }
}

describe('AssetProcessingService', () => {
  it('处理成功 → ready + 变体登记', async () => {
    const { service, asset, assets } = setup({
      status: 'ready',
      variants: [{ kind: 'thumb', objectKey: 'k', mimeType: 'image/png', size: 1 }],
      metadata: { width: 10 },
    })
    const result = await service.process('org-1', 'a1')
    expect(result).toMatchObject({ skipped: false })
    expect(asset.status).toBe('ready')
    expect(asset.metadata).toMatchObject({ width: 10, scanProvider: 'noop' })
    expect(assets.addVariant).toHaveBeenCalledWith('org-1', 'a1', expect.objectContaining({ kind: 'thumb' }))
  })

  it('infected → quarantined', async () => {
    const { service, asset } = setup({ status: 'quarantined', reason: 'virus' })
    await service.process('org-1', 'a1')
    expect(asset.status).toBe('quarantined')
  })

  it('processor 抛错 → failed 且保留错误', async () => {
    const { service, asset, assets } = setup()
    const failing = {
      name: 'fail',
      kinds: ['image'] as const,
      process: jest.fn(async () => {
        throw new Error('decode failed')
      }),
    }
    const registry = new AssetProcessorRegistry()
    registry.register(failing)
    const failingService = new AssetProcessingService({ save: assets.save } as never, registry, assets as never)
    await expect(failingService.process('org-1', 'a1')).rejects.toThrow('decode failed')
    expect(asset.status).toBe('failed')
    expect(asset.metadata).toMatchObject({ processingError: 'decode failed' })
  })

  it('已 ready/quarantined 跳过', async () => {
    const { service, asset } = setup()
    asset.status = 'ready'
    await expect(service.process('org-1', 'a1')).resolves.toMatchObject({ skipped: true })
  })

  it('扫描 infected → quarantined，不执行 processor', async () => {
    const asset = {
      id: 'a1',
      organizationId: 'org-1',
      kind: 'image',
      status: 'scanning',
      scanStatus: 'pending',
      metadata: null,
    }
    const repo = { save: jest.fn(async (row) => row) }
    const assets = {
      get: jest.fn(async () => asset),
      save: repo.save,
      addVariant: jest.fn(),
    }
    const registry = new AssetProcessorRegistry()
    const processor = { name: 'image', kinds: ['image'] as const, process: jest.fn() }
    registry.register(processor)
    const scanner = {
      name: 'fake',
      scan: jest.fn(async () => ({ status: 'infected', detail: 'virus' })),
    }
    const service = new AssetProcessingService(
      repo as never,
      registry,
      assets as never,
      scanner as never,
      { get: jest.fn(async () => Buffer.from('x')) } as never,
    )
    const result = await service.process('org-1', 'a1')
    expect(result).toMatchObject({ reason: 'infected' })
    expect(asset.status).toBe('quarantined')
    expect(asset.scanStatus).toBe('infected')
    expect(processor.process).not.toHaveBeenCalled()
  })

  it('扫描 error → failed（fail-closed）', async () => {
    const asset = {
      id: 'a1',
      organizationId: 'org-1',
      kind: 'image',
      status: 'scanning',
      scanStatus: 'pending',
      metadata: null,
    }
    const repo = { save: jest.fn(async (row) => row) }
    const assets = {
      get: jest.fn(async () => asset),
      save: repo.save,
      addVariant: jest.fn(),
    }
    const registry = new AssetProcessorRegistry()
    registry.register({ name: 'image', kinds: ['image'] as const, process: jest.fn() })
    const service = new AssetProcessingService(
      repo as never,
      registry,
      assets as never,
      { name: 'fake', scan: jest.fn(async () => ({ status: 'error', detail: 'timeout' })) } as never,
      { get: jest.fn(async () => Buffer.from('x')) } as never,
    )
    const result = await service.process('org-1', 'a1')
    expect(result).toMatchObject({ reason: 'scan-error' })
    expect(asset.status).toBe('failed')
    expect(asset.scanStatus).toBe('error')
  })

  it('未知 kind → AssetProcessorError', () => {
    const registry = new AssetProcessorRegistry()
    expect(() => registry.forKind('video')).toThrow(AssetProcessorError)
  })
})
