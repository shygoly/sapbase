import { Injectable } from '@nestjs/common'
import type { Asset, AssetKind } from './asset.entity'

export interface AssetVariantResult {
  kind: string
  objectKey: string
  mimeType: string
  size: number
  width?: number | null
  height?: number | null
  metadata?: Record<string, unknown> | null
}

export interface AssetProcessResult {
  status: 'ready' | 'quarantined' | 'failed'
  metadata?: Record<string, unknown> | null
  variants?: AssetVariantResult[]
  reason?: string
}

export interface AssetProcessor {
  readonly name: string
  readonly kinds: readonly AssetKind[]
  process(asset: Asset): Promise<AssetProcessResult>
}

export class AssetProcessorError extends Error {
  constructor(message: string, readonly reason: 'unknown-processor' | 'processing-failed') {
    super(message)
    this.name = 'AssetProcessorError'
  }
}

@Injectable()
export class AssetProcessorRegistry {
  private readonly processors = new Map<string, AssetProcessor>()

  register(processor: AssetProcessor): void {
    if (!processor.name || processor.kinds.length === 0) {
      throw new AssetProcessorError('processor 缺少 name/kinds', 'unknown-processor')
    }
    this.processors.set(processor.name, processor)
  }

  forKind(kind: AssetKind): AssetProcessor {
    const processor = [...this.processors.values()].find((item) => item.kinds.includes(kind))
    if (!processor) {
      throw new AssetProcessorError(`没有可处理 ${kind} 的 processor`, 'unknown-processor')
    }
    return processor
  }

  get(name: string): AssetProcessor {
    const processor = this.processors.get(name)
    if (!processor) throw new AssetProcessorError(`未注册 processor：${name}`, 'unknown-processor')
    return processor
  }

  list(): AssetProcessor[] {
    return [...this.processors.values()]
  }
}
