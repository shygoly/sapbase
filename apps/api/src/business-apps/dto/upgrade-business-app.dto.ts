import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'

export class UpgradeBusinessAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/, {
    message: 'packageId 只能包含小写字母、数字、点、下划线和连字符',
  })
  packageId: string
}
