import { IsOptional, IsUUID } from 'class-validator'

export class RollbackBusinessAppDto {
  @IsOptional()
  @IsUUID()
  revisionId?: string
}
