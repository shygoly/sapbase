import { PartialType } from '@nestjs/mapped-types'
import { CreateSystemFuelTypeDto } from './create-system-fuel-type.dto'

export class UpdateSystemFuelTypeDto extends PartialType(CreateSystemFuelTypeDto) {}
