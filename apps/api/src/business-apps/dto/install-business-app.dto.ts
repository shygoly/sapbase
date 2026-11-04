import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import type { BusinessAppDeploymentProfile } from '@speckit/shared-schemas'

export class InstallBusinessAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/, {
    message: 'packageId 只能包含小写字母、数字、点、下划线和连字符',
  })
  packageId: string

  @IsOptional()
  @IsIn(['shared-saas', 'dedicated-saas', 'standalone'])
  deploymentProfile?: BusinessAppDeploymentProfile
}
