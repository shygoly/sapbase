import { All, Controller, GoneException } from '@nestjs/common'

/**
 * 旧工作流 HTTP 墓碑：所有 /workflows 与 /workflow-instances 路径一律 410。
 * 不依赖旧树；body 给出蓝图侧对应读/写路径。
 */
export const LEGACY_WORKFLOW_GONE_BODY = {
  message: '旧工作流接口已退场',
  migratedTo: [
    { from: 'GET /api/workflows', to: 'GET /api/blueprints' },
    {
      from: 'GET /api/workflow-instances',
      to: 'GET /api/blueprints/:id/records/:entity?state=',
    },
    {
      from: 'POST /api/workflow-instances/:id/transition',
      to: 'POST /api/blueprints/:id/records/:entity/:recordId/transition',
    },
    {
      from: 'GET /api/workflow-instances/:id/history',
      to: 'GET /api/blueprints/:id/records/:entity/:recordId/history',
    },
  ],
}

function throwGone(): never {
  throw new GoneException(LEGACY_WORKFLOW_GONE_BODY)
}

@Controller('workflows')
export class LegacyWorkflowsGoneController {
  @All()
  goneRoot(): never {
    return throwGone()
  }

  @All('*')
  goneNested(): never {
    return throwGone()
  }
}

@Controller('workflow-instances')
export class LegacyWorkflowInstancesGoneController {
  @All()
  goneRoot(): never {
    return throwGone()
  }

  @All('*')
  goneNested(): never {
    return throwGone()
  }
}
