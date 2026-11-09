import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset } from './asset.entity'
import { AssetProcessorRegistry } from './asset-processor'
import { AssetsService } from './assets.service'

/**
 * 处理管道编排：scanning → processor → ready/quarantined/failed。
 * processor 只返回结果；状态落库与变体登记在这里统一做，避免每个 processor 各写一份。
 */
@Injectable()
export class AssetProcessingService {
  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    private readonly registry: AssetProcessorRegistry,
    private readonly assetsService: AssetsService,
  ) {}

  async process(organizationId: string, assetId: string) {
    const asset = await this.assetsService.get(organizationId, assetId)
    if (asset.status === 'ready' || asset.status === 'quarantined') {
      return { asset, skipped: true }
    }
    asset.status = 'scanning'
    await this.assets.save(asset)
    const processor = this.registry.forKind(asset.kind)
    try {
      const result = await processor.process(asset)
      for (const variant of result.variants ?? []) {
        await this.assetsService.addVariant(organizationId, asset.id, variant)
      }
      asset.status = result.status
      asset.metadata = result.metadata ?? asset.metadata
      await this.assets.save(asset)
      return { asset, skipped: false, reason: result.reason }
    } catch (error) {
      asset.status = 'failed'
      asset.metadata = {
        ...(asset.metadata ?? {}),
        processingError: error instanceof Error ? error.message : String(error),
      }
      await this.assets.save(asset)
      throw error
    }
  }
}
