import { PartialType } from '@nestjs/mapped-types'
import { CreateCiiShipTypeParameterDto } from './create-cii-ship-type-parameter.dto'

export class UpdateCiiShipTypeParameterDto extends PartialType(CreateCiiShipTypeParameterDto) {}
