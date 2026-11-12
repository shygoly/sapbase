import { Injectable } from '@nestjs/common'
import type { AssetProcessor, AssetProcessResult } from './asset-processor'

/** archive/other：无安全处理能力，明确标记为 skipped 但允许 ready。 */
@Injectable()
export class DefaultAssetProcessor implements AssetProcessor {
  readonly name = 'default'
  readonly kinds = ['archive', 'other'] as const

  async process(): Promise<AssetProcessResult> {
    return {
      status: 'ready',
      metadata: { processor: 'default', mediaProcessing: 'skipped' },
    }
  }
}
