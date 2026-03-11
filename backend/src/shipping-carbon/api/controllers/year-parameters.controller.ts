import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { YearParametersService } from '../../application/services/year-parameters.service'
import { CreateYearParameterDto } from '../../dto/create-year-parameter.dto'
import { UpdateYearParameterDto } from '../../dto/update-year-parameter.dto'

@Controller('shipping/constants/years')
@Auth()
export class YearParametersController {
  constructor(private readonly service: YearParametersService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Post()
  create(@Body() dto: CreateYearParameterDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateYearParameterDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id)
    return { success: true }
  }
}
