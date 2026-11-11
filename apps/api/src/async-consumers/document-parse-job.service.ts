import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '@sap/platform-core/assets/object-storage'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'

const TEXT_MIME = /^(text\/|application\/(json|xml|markdown|csv|yaml|x-yaml))/i
const MAX_TEXT_BYTES = 2 * 1024 * 1024

/**
 * 文档解析任务：从 asset-pipeline 取已就绪文本类资产并返回抽取文本。
 *
 * 不引入第二套文档真源：解析结果是任务产物，下游（文档智能/索引）自行落库。
 * 二进制/未就绪/跨租户资产拒绝。
 */
@Injectable()
export class DocumentParseJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('document.parse')) return
    this.registry.register({
      type: 'document.parse',
      typeVersion: 1,
      timeoutMs: 120_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 30_000 },
      concurrency: 2,
      payloadSchema: {
        type: 'object',
        required: ['assetId'],
        properties: { assetId: { type: 'string', minLength: 1 } },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        await ctx.stage('loading', { assetId: payload.assetId })
        const asset = await this.assets.findOne({
          where: { id: String(payload.assetId), organizationId: ctx.organizationId },
        })
        if (!asset) throw new BadRequestException('资产不存在或不属于当前组织')
        if (asset.status !== 'ready') {
          throw new BadRequestException(`资产未就绪：${asset.status}`)
        }
        if (!TEXT_MIME.test(asset.mimeType)) {
          throw new BadRequestException(`暂不支持解析该 MIME 类型：${asset.mimeType}`)
        }
        const buffer = await this.storage.get(asset.objectKey)
        if (buffer.byteLength > MAX_TEXT_BYTES) {
          throw new BadRequestException(`文档超过解析上限 ${MAX_TEXT_BYTES} bytes`)
        }
        await ctx.progress(80)
        const text = buffer.toString('utf8')
        await ctx.progress(100)
        return {
          result: {
            assetId: asset.id,
            mimeType: asset.mimeType,
            bytes: buffer.byteLength,
            text,
          },
        }
      },
    })
  }
}
