import { IsEnum, IsOptional, IsString } from 'class-validator'
import { LabMethodStatus } from '../lab-method.entity'

export class CreateLabMethodDto {
  @IsString()
  methodCode: string

  @IsString()
  methodName: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(LabMethodStatus)
  status?: LabMethodStatus
}
