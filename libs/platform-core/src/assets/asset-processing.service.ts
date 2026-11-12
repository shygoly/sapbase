import { Inject, Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset } from './asset.entity'
import { AssetProcessorRegistry } from './asset-processor'
import { ASSET_SCANNER, NoopAssetScanner, type AssetScanner } from './asset-scanner'
import { AssetsService } from './assets.service'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

/**
 * 处理管道编排：scanning → scan → processor → ready/quarantined/failed。
 * processor 只返回结果；状态落库与变体登记在这里统一做，避免每个 processor 各写一份。
 */
@Injectable()
export class AssetProcessingService {
  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    private readonly registry: AssetProcessorRegistry,
    private readonly assetsService: AssetsService,
    @Optional()
    @Inject(ASSET_SCANNER)
    private readonly scanner?: AssetScanner,
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStorage,
  ) {}

  async process(organizationId: string, assetId: string) {
    const asset = await this.assetsService.get(organizationId, assetId)
    if (asset.status === 'ready' || asset.status === 'quarantined') {
      return { asset, skipped: true }
    }
    asset.status = 'scanning'
    asset.scanStatus = 'pending'
    await this.assets.save(asset)
    const scanner = this.scanner ?? new NoopAssetScanner()
    const scan = await scanner.scan(asset, async () => {
      if (!this.storage) throw new Error('未配置对象存储，无法扫描资产')
      return this.storage.get(asset.objectKey)
    })
    asset.scanStatus = scan.status
    if (scan.status === 'infected') {
      asset.status = 'quarantined'
      asset.metadata = {
        ...(asset.metadata ?? {}),
        scanProvider: scanner.name,
        scanDetail: scan.detail ?? 'infected',
      }
      await this.assets.save(asset)
      return { asset, skipped: false, reason: 'infected' }
    }
    if (scan.status === 'error') {
      asset.status = 'failed'
      asset.metadata = {
        ...(asset.metadata ?? {}),
        scanProvider: scanner.name,
        scanError: scan.detail ?? 'scan error',
      }
      await this.assets.save(asset)
      return { asset, skipped: false, reason: 'scan-error' }
    }
    asset.status = 'processing'
    await this.assets.save(asset)
    const processor = this.registry.forKind(asset.kind)
    try {
      const result = await processor.process(asset)
      for (const variant of result.variants ?? []) {
        await this.assetsService.addVariant(organizationId, asset.id, variant)
      }
      asset.status = result.status
      asset.metadata = {
        ...(asset.metadata ?? {}),
        ...(result.metadata ?? {}),
        scanProvider: scanner.name,
      }
      if (result.width !== undefined) asset.width = result.width
      if (result.height !== undefined) asset.height = result.height
      if (result.durationMs !== undefined) asset.durationMs = result.durationMs
      if (result.pageCount !== undefined) asset.pageCount = result.pageCount
      if (result.size !== undefined) asset.size = String(result.size)
      await this.assets.save(asset)
      return { asset, skipped: false, reason: result.reason }
    } catch (error) {
      asset.status = 'failed'
      asset.metadata = {
        ...(asset.metadata ?? {}),
        scanProvider: scanner.name,
        processingError: error instanceof Error ? error.message : String(error),
      }
      await this.assets.save(asset)
      throw error
    }
  }
}
