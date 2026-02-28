import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LabMethod } from './lab-method.entity'
import { LabMethodVersion } from './lab-method-version.entity'
import { MethodContextService } from './method-context.service'
import { MethodContextController } from './method-context.controller'

@Module({
  imports: [TypeOrmModule.forFeature([LabMethod, LabMethodVersion])],
  controllers: [MethodContextController],
  providers: [MethodContextService],
  exports: [MethodContextService, TypeOrmModule],
})
export class MethodContextModule {}
