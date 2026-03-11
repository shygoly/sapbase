import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { OrganizationId } from '../../../organizations/decorators/organization-id.decorator'
import { SystemFuelTypesService } from '../../application/services/system-fuel-types.service'
import { CreateSystemFuelTypeDto } from '../../dto/create-system-fuel-type.dto'
import { UpdateSystemFuelTypeDto } from '../../dto/update-system-fuel-type.dto'

@Controller('shipping/constants/fuels/system')
@Auth()
export class SystemFuelTypesController {
  constructor(private readonly service: SystemFuelTypesService) {}

  @Get()
  findAll(@OrganizationId() organizationId: string) {
    return this.service.findAll(organizationId)
  }

  @Post()
  create(@OrganizationId() organizationId: string, @Body() dto: CreateSystemFuelTypeDto) {
    return this.service.create(organizationId, dto)
  }

  @Patch(':id')
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSystemFuelTypeDto,
  ) {
    return this.service.update(organizationId, id, dto)
  }

  @Delete(':id')
  async delete(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.service.delete(organizationId, id)
    return { success: true }
  }
}
