import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'node:path'
import { Asset } from './asset.entity'
import { AssetVariant } from './asset-variant.entity'
import { AssetUploadSession } from './asset-upload-session.entity'
import { AssetUploadsController } from './asset-uploads.controller'
import { LocalStorageController } from './local-storage.controller'
import { AssetUploadService } from './asset-upload.service'
import { AssetsController } from './assets.controller'
import { AssetsService } from './assets.service'
import { AssetProcessorRegistry } from './asset-processor'
import { AssetProcessingService } from './asset-processing.service'
import { LocalObjectStorage } from './local-object-storage'
import { S3ObjectStorage } from './s3-object-storage'
import { OBJECT_STORAGE } from './object-storage'
import { ASSET_SCANNER, createAssetScanner } from './asset-scanner'
import { ImageAssetProcessor } from './image-asset.processor'
import { VideoAssetProcessor } from './video-asset.processor'
import { AudioAssetProcessor } from './audio-asset.processor'
import { DocumentAssetProcessor } from './document-asset.processor'
import { DefaultAssetProcessor } from './default-asset.processor'
import { JobsModule } from '../jobs/jobs.module'
import { Organization } from '../organizations/organization.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetVariant, AssetUploadSession, Organization]), JobsModule],
  controllers: [AssetsController, AssetUploadsController, LocalStorageController],
  providers: [
    AssetsService,
    AssetUploadService,
    ImageAssetProcessor,
    VideoAssetProcessor,
    AudioAssetProcessor,
    DocumentAssetProcessor,
    DefaultAssetProcessor,
    {
      provide: AssetProcessorRegistry,
      useFactory: (
        image: ImageAssetProcessor,
        video: VideoAssetProcessor,
        audio: AudioAssetProcessor,
        document: DocumentAssetProcessor,
        fallback: DefaultAssetProcessor,
      ) => {
        const registry = new AssetProcessorRegistry()
        for (const processor of [image, video, audio, document, fallback]) {
          registry.register(processor)
        }
        return registry
      },
      inject: [
        ImageAssetProcessor,
        VideoAssetProcessor,
        AudioAssetProcessor,
        DocumentAssetProcessor,
        DefaultAssetProcessor,
      ],
    },
    AssetProcessingService,
    {
      provide: ASSET_SCANNER,
      useFactory: () => createAssetScanner(),
    },
    {
      provide: OBJECT_STORAGE,
      useFactory: () => {
        const provider = process.env.ASSET_STORAGE_PROVIDER
        const bucket = process.env.ASSET_S3_BUCKET
        if (provider === 's3' || bucket) {
          if (!bucket) throw new Error('ASSET_S3_BUCKET 未配置')
          let credentials: { accessKeyId?: string; secretAccessKey?: string } = {
            accessKeyId: process.env.ASSET_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.ASSET_S3_SECRET_ACCESS_KEY,
          }
          const secretRef = process.env.ASSET_S3_SECRET_REF
          if (secretRef) {
            const raw = process.env[secretRef]
            if (!raw) throw new Error(`secretRef ${secretRef} 未解析到值`)
            credentials = JSON.parse(raw) as typeof credentials
          }
          return new S3ObjectStorage({
            bucket,
            region: process.env.ASSET_S3_REGION ?? 'us-east-1',
            endpoint: process.env.ASSET_S3_ENDPOINT,
            forcePathStyle: process.env.ASSET_S3_FORCE_PATH_STYLE === 'true',
            ...credentials,
          })
        }
        return new LocalObjectStorage({
          rootDir: process.env.ASSET_STORAGE_DIR ?? join(process.cwd(), '.data/assets'),
        })
      },
    },
  ],
  exports: [
    AssetsService,
    AssetUploadService,
    AssetProcessorRegistry,
    AssetProcessingService,
    TypeOrmModule,
    OBJECT_STORAGE,
  ],
})
export class AssetsModule {}
