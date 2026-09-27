import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { InboxService } from './inbox.service'

type InboxUser = {
  role?: string
  organizationId?: string
}

@ApiTags('Inbox')
@Controller('inbox')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: '当前调用者的全部待审项（跨单据类型）' })
  async list(@CurrentUser() user?: InboxUser) {
    return this.inbox.listForCaller(user)
  }
}
