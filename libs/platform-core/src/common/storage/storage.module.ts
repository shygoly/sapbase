import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AssetsModule } from '../../assets/assets.module'
import { StorageService } from './storage.service'

@Module({
  imports: [ConfigModule, AssetsModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
