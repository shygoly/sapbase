import { Type } from 'class-transformer'
import { IsNumber, IsPositive, Max, Min } from 'class-validator'

export class CreateYearParameterDto {
  @Type(() => Number)
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year: number

  @Type(() => Number)
  @IsNumber()
  fuelEuTarget: number

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  etsCoverageRatio: number

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  euaPrice: number
}
