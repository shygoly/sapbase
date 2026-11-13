import { ConflictException, Injectable } from '@nestjs/common'
import { AgentEvalService } from '../agent-eval/agent-eval.service'

export interface PublicationGateInput {
  blueprintId: string
  releaseId?: string
  modelId?: string
  requiredSuites?: string[]
}

export interface PublicationGateResult {
  ok: boolean
  blueprintId: string
  releaseId: string | null
  requiredSuites: string[]
  gates: Array<{
    suite: string
    ok: boolean
    evidence: string
    reasons: string[]
  }>
  reasons: string[]
}

const DEFAULT_REQUIRED_SUITES = ['injection', 'write', 'refusal']

/**
 * Blueprint 发布前评测门（5.6）。
 *
 * 至少要求 injection / write / refusal 三套评测；injection 必须 100%，
 * 写工具未确认次数必须为 0；指定 modelId 时必须存在该模型的评测记录。
 * 缺证据 fail-closed，不能以“无评测”直接发布。
 */
@Injectable()
export class BlueprintPublicationGateService {
  constructor(private readonly evalService: AgentEvalService) {}

  async evaluate(input: PublicationGateInput): Promise<PublicationGateResult> {
    const requiredSuites = input.requiredSuites ?? DEFAULT_REQUIRED_SUITES
    const reasons: string[] = []
    if (!input.releaseId) {
      return {
        ok: false,
        blueprintId: input.blueprintId,
        releaseId: null,
        requiredSuites,
        gates: [],
        reasons: ['Blueprint 发布前必须提供 releaseId 以关联评测证据'],
      }
    }
    const runs = await this.evalService.listRuns(input.releaseId)
    if (runs.length === 0) {
      return {
        ok: false,
        blueprintId: input.blueprintId,
        releaseId: input.releaseId,
        requiredSuites,
        gates: [],
        reasons: ['该 Release 没有任何评测记录'],
      }
    }
    if (
      input.modelId &&
      !runs.some((run) => run.modelId === input.modelId)
    ) {
      reasons.push(`缺少 modelId=${input.modelId} 的评测记录`)
    }

    const gates = requiredSuites.map((suite) => {
      const suiteRuns = runs.filter((run) => run.suite === suite)
      if (suiteRuns.length === 0) {
        return {
          suite,
          ok: false,
          evidence: 'no-run',
          reasons: [`缺少 ${suite} 套件评测`],
        }
      }
      const passed = suiteRuns.reduce((sum, run) => sum + run.passed, 0)
      const failed = suiteRuns.reduce((sum, run) => sum + run.failed, 0)
      const writeUnconfirmed = suiteRuns.reduce(
        (sum, run) => sum + Number(run.details?.writeUnconfirmed ?? 0),
        0,
      )
      const gate = this.evalService.gate({
        suite,
        passed,
        failed,
        writeUnconfirmed,
      })
      return {
        suite,
        ok: gate.ok,
        evidence: `${passed}/${passed + failed}`,
        reasons: gate.reasons,
      }
    })
    for (const gate of gates) {
      if (!gate.ok) reasons.push(...gate.reasons.map((reason) => `${gate.suite}: ${reason}`))
    }
    return {
      ok: reasons.length === 0 && gates.every((gate) => gate.ok),
      blueprintId: input.blueprintId,
      releaseId: input.releaseId,
      requiredSuites,
      gates,
      reasons,
    }
  }

  async assertPublishable(input: PublicationGateInput): Promise<PublicationGateResult> {
    const result = await this.evaluate(input)
    if (!result.ok) {
      throw new ConflictException(
        `Blueprint 发布评测门未通过：${result.reasons.join('；')}`,
      )
    }
    return result
  }
}
