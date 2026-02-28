import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LabSample } from './lab-sample.entity'
import { SampleContextService } from './sample-context.service'
import { SampleContextController } from './sample-context.controller'

@Module({
  imports: [TypeOrmModule.forFeature([LabSample])],
  providers: [SampleContextService],
  controllers: [SampleContextController],
  exports: [SampleContextService, TypeOrmModule],
})
export class SampleContextModule {}
