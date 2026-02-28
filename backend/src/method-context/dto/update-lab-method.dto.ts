import { PartialType } from '@nestjs/mapped-types'
import { CreateLabMethodDto } from './create-lab-method.dto'

export class UpdateLabMethodDto extends PartialType(CreateLabMethodDto) {}
