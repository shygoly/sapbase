import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { SemanticRuntimeService, toHttpException } from './semantic-runtime.service'

type RuntimeUser = {
  id?: string
  userId?: string
  organizationId?: string
  permissions?: string[]
}

@ApiTags('Blueprints')
@Controller('blueprints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SemanticRuntimeController {
  constructor(private readonly runtime: SemanticRuntimeService) {}

  @Get(':id/traceability/batch/:code')
  @ApiOperation({ summary: '按批次号反向查询相关单据与客户（未知批次 200 + found:false）' })
  async traceBatch(
    @Param('id') id: string,
    @Param('code') code: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.traceBatch(id, code, user?.organizationId ?? '', user)
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/views/stock')
  @ApiOperation({ summary: '平台内置库存视图：按零件聚合 StockItem（空结果 200 + []）' })
  async viewStock(
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.viewStock(id, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/views/in-transit')
  @ApiOperation({ summary: '平台内置在途视图：按零件聚合 StockItem.inTransit' })
  async viewInTransit(
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.viewInTransit(id, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/views/receivable')
  @ApiOperation({ summary: '平台内置应收视图：已确认未结清订单按客户合计 totalAmount' })
  async viewReceivable(
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.viewReceivable(id, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/fitment/parts')
  @ApiOperation({ summary: '车辆适配宿主查询：车型/年款/位置 → 零件候选（不是原子）' })
  async queryFitment(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.queryFitment(id, query, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Post(':id/import/:entity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '主数据导入（CSV/JSON 二选一）；合法行落库，非法行逐条报错' })
  async importMaster(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Body() body: { csv?: string; rows?: object[]; dryRun?: boolean },
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.importMaster(id, entity, body ?? {}, user?.organizationId ?? '', user)
    } catch (error) {
      toHttpException(error)
    }
  }

  @Post(':id/records/:entity')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '按已装载模板写入实体实例（fail-closed，不部分写入）' })
  async write(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.write(id, entity, body ?? {}, user?.organizationId ?? '', user)
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/records/:entity')
  @ApiOperation({ summary: '按租户读回某实体的实例（无查询参数仍返回裸数组）' })
  async list(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.list(id, entity, user?.organizationId ?? '', query, user)
    } catch (error) {
      toHttpException(error)
    }
  }

  @Post(':id/records/:entity/:recordId/transition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行模板声明的状态迁移（非法迁移拒，状态不变）' })
  async transition(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @Body() body: { to?: unknown; expectedVersion?: unknown },
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.transition(
        id,
        entity,
        recordId,
        body ?? {},
        user?.organizationId ?? '',
        user?.id ?? user?.userId,
        user,
      )
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/records/:entity/:recordId/approvals')
  @ApiOperation({ summary: '读回单据审批链（待审 = 链上存在 pending，不发明状态名）' })
  async listApprovals(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.listApprovals(id, entity, recordId, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Post(':id/records/:entity/:recordId/approvals/:ruleId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '推进当前待审步骤；角色不符返回 403' })
  async approve(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: { role?: unknown },
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.approve(
        id,
        entity,
        recordId,
        ruleId,
        body?.role,
        user?.organizationId ?? '',
        user?.id ?? user?.userId,
      )
    } catch (error) {
      toHttpException(error)
    }
  }

  @Delete(':id/records/:entity/:recordId')
  @ApiOperation({ summary: '删除实例；被引用则按 onDelete 策略处理' })
  async remove(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    try {
      return await this.runtime.remove(id, entity, recordId, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }
}
