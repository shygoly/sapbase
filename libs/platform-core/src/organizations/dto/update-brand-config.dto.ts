import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, IsUrl, IsEmail, MaxLength } from 'class-validator'

class ThemeDto {
  @ApiProperty({ required: false, example: '#000000' })
  @IsOptional()
  @IsString()
  primary?: string

  @ApiProperty({ required: false, example: '#666666' })
  @IsOptional()
  @IsString()
  secondary?: string

  @ApiProperty({ required: false, example: '#0066CC' })
  @IsOptional()
  @IsString()
  accent?: string

  @ApiProperty({ required: false, example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  background?: string

  @ApiProperty({ required: false, example: '#000000' })
  @IsOptional()
  @IsString()
  foreground?: string
}

export class UpdateBrandConfigDto {
  @ApiProperty({ required: false, example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string | null

  @ApiProperty({ required: false, example: 'https://example.com/favicon.ico' })
  @IsOptional()
  @IsUrl()
  faviconUrl?: string | null

  @ApiProperty({ required: false, type: ThemeDto })
  @IsOptional()
  theme?: ThemeDto

  @ApiProperty({ required: false, example: '.custom-class { color: red; }' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customCss?: string | null

  @ApiProperty({ required: false, example: 'My Custom App' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  appName?: string | null

  @ApiProperty({ required: false, example: 'support@example.com' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string | null

  @ApiProperty({ required: false, example: 'https://support.example.com' })
  @IsOptional()
  @IsUrl()
  supportUrl?: string | null
}
