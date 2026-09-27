import { PartialType } from '@nestjs/mapped-types'
import { CreateYearParameterDto } from './create-year-parameter.dto'

export class UpdateYearParameterDto extends PartialType(CreateYearParameterDto) {}
