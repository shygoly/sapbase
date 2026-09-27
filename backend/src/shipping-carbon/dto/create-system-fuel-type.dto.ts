import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString } from 'class-validator'

export class CreateSystemFuelTypeDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  code?: string

  @Type(() => Number)
  @IsNumber()
  lcv: number

  @Type(() => Number)
  @IsNumber()
  wellToTankFactor: number

  @Type(() => Number)
  @IsNumber()
  tankToWakeFactor: number

  @Type(() => Number)
  @IsNumber()
  co2eqWtw: number

  @Type(() => Number)
  @IsNumber()
  co2Factor: number

  @Type(() => Number)
  @IsNumber()
  gwpCo2: number

  @Type(() => Number)
  @IsNumber()
  gwpCh4: number

  @Type(() => Number)
  @IsNumber()
  gwpN2o: number

  @Type(() => Number)
  @IsNumber()
  slipFactor: number

  @Type(() => Number)
  @IsNumber()
  defaultPrice: number

  @IsOptional()
  scope?: 'system' | 'tenant'
}
