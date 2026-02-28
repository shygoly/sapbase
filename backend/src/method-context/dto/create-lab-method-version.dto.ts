import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateLabMethodVersionDto {
  @IsOptional()
  @IsString()
  versionStatus?: string

  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>
}
