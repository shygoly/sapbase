import { Body, Controller, Post } from '@nestjs/common'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AgentEvalService } from './agent-eval.service'

@Controller('agent-eval')
export class AgentEvalController {
  constructor(private readonly evalService: AgentEvalService) {}

  @Post('run')
  @Auth('system:manage')
  run(
    @Body()
    body: {
      releaseId?: string
      skillVersion?: string
      suite: string
      caseResults: Array<{ caseKey: string; passed: boolean; reason?: string }>
    },
    @OrganizationId() organizationId: string,
  ) {
    return this.evalService.run({
      organizationId,
      releaseId: body.releaseId ?? null,
      skillVersion: body.skillVersion ?? null,
      suite: body.suite,
      caseResults: body.caseResults ?? [],
    })
  }

  @Post('gate')
  @Auth()
  gate(
    @Body()
    body: {
      suite: string
      passed: number
      failed: number
      writeUnconfirmed?: number
      injectionPassRate?: number
      previous?: { passed: number; failed: number } | null
    },
  ) {
    return this.evalService.gate(body)
  }
}
