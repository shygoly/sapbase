import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'node:path'
import { Asset } from './asset.entity'
import { AssetVariant } from './asset-variant.entity'
import { AssetUploadSession } from './asset-upload-session.entity'
import { AssetUploadsController } from './asset-uploads.controller'
import { AssetUploadService } from './asset-upload.service'
import { AssetsController } from './assets.controller'
import { AssetsService } from './assets.service'
import { AssetProcessorRegistry } from './asset-processor'
import { AssetProcessingService } from './asset-processing.service'
import { LocalObjectStorage } from './local-object-storage'
import { OBJECT_STORAGE } from './object-storage'

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetVariant, AssetUploadSession])],
  controllers: [AssetsController, AssetUploadsController],
  providers: [
    AssetsService,
    AssetUploadService,
    AssetProcessorRegistry,
    AssetProcessingService,
    {
      provide: OBJECT_STORAGE,
      useFactory: () =>
        new LocalObjectStorage({
          rootDir: process.env.ASSET_STORAGE_DIR ?? join(process.cwd(), '.data/assets'),
        }),
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
