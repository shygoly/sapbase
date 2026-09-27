import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ChatOrchestrator } from './chat-orchestrator'

interface AuthedRequest {
  user?: {
    id?: string
    userId?: string
    email?: string
    organizationId?: string
    permissions?: string[]
  }
}

/**
 * 会话入口。守卫只用 JwtAuthGuard：工具权限由 registry 在 invoke 时 all-of 判，
 * 不要再叠 @Auth / @Permissions。
 */
@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly orchestrator: ChatOrchestrator) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '把一句话编排成 Interaction Plan 或明确拒绝' })
  message(
    @Body() body: { message?: string },
    @Request() req: AuthedRequest,
  ) {
    const message = body?.message
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: 'message 不能为空或只含空白',
        },
        400,
      )
    }

    const organizationId = req.user?.organizationId
    if (!organizationId) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: '缺少组织上下文（organizationId），无法记录审计，拒绝执行',
        },
        400,
      )
    }

    return this.orchestrator.handleMessage(message, {
      organizationId,
      actor: req.user?.email ?? req.user?.userId ?? 'unknown',
      grantedPermissions: req.user?.permissions ?? [],
    })
  }
}
