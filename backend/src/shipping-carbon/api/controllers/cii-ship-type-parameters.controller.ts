import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { CiiShipTypeParametersService } from '../../application/services/cii-ship-type-parameters.service'
import { CreateCiiShipTypeParameterDto } from '../../dto/create-cii-ship-type-parameter.dto'
import { UpdateCiiShipTypeParameterDto } from '../../dto/update-cii-ship-type-parameter.dto'

@Controller('shipping/constants/cii-ship-types')
@Auth()
export class CiiShipTypeParametersController {
  constructor(private readonly service: CiiShipTypeParametersService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Post()
  create(@Body() dto: CreateCiiShipTypeParameterDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCiiShipTypeParameterDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id)
    return { success: true }
  }
}
