import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateCiiShipTypeParameterDto {
  @IsString()
  shipType: string

  @IsOptional()
  @IsString()
  applicableStandard?: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rangeMin: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rangeMax?: number | null

  @Type(() => Number)
  @IsNumber()
  referenceCii: number

  @Type(() => Number)
  @IsNumber()
  requiredCii: number

  @Type(() => Number)
  @IsNumber()
  d1: number

  @Type(() => Number)
  @IsNumber()
  d2: number

  @Type(() => Number)
  @IsNumber()
  d3: number

  @Type(() => Number)
  @IsNumber()
  d4: number

  @Type(() => Number)
  @IsNumber()
  correctionFactor: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  constantCapacity?: number | null

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useMax?: boolean
}
