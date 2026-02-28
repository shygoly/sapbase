import { PartialType } from '@nestjs/mapped-types'
import { IsEnum, IsOptional, IsUUID } from 'class-validator'
import { CreateLabSampleDto } from './create-lab-sample.dto'
import { LabSampleStatus } from '../lab-sample.entity'

export class UpdateLabSampleDto extends PartialType(CreateLabSampleDto) {
  @IsOptional()
  @IsEnum(LabSampleStatus)
  status?: LabSampleStatus

  @IsOptional()
  @IsUUID()
  assignedAnalystId?: string

  @IsOptional()
  @IsUUID()
  assignedMethodId?: string
}
