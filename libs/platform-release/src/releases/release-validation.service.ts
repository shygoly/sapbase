import { Injectable } from '@nestjs/common'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BlueprintService } from '../blueprint/blueprint.service'
import type { ReleaseEvalPort } from './release-ports'
import { resolveRepoRoot } from '@sap/platform-core/common/repo-root'

export interface GateEvidence {
  status: 'passed' | 'failed' | 'pending' | 'not_applicable'
  evidence?: string
  notApplicableReason?: string
  error?: string
  gate?: string
  rule?: string
  path?: string
  howToFix?: string
}

export interface ValidationInput {
  proposal: {
    type: string
    areas: string[]
    diff: Record<string, unknown>
    risk: Record<string, unknown>
    testPlan: Record<string, unknown>
    rollbackPlan: Record<string, unknown>
  }
  blueprintId?: string
  previewUrl?: string
  releaseId?: string
  modelId?: string
  eval?: { suite: string; passed: number; failed: number; writeUnconfirmed?: number; previous?: { passed: number; failed: number } | null }
}

@Injectable()
export class ReleaseValidationService {
  constructor(
    private readonly blueprints: BlueprintService,
    private readonly evalService: ReleaseEvalPort,
  ) {}

  async validate(input: ValidationInput): Promise<{ ok: boolean; gates: Record<string, GateEvidence> }> {
    const gates: Record<string, GateEvidence> = {}
    gates.G0 = this.runCheckers()
    gates.G1 = input.blueprintId ? await this.runBlueprintCompile(input.blueprintId) : this.na('未提供 blueprintId')
    gates.G2 = this.permissionGate(input.proposal)
    gates.G3 = this.migrationGate(input.proposal)
    gates.G4 = this.testGate(input.proposal)
    gates.G5 = await this.resolveEvalGate(input)
    gates.G6 = input.previewUrl ? { status: 'passed', evidence: input.previewUrl } : this.na('未提供预览冒烟记录')
    gates.G7 = { status: 'pending', evidence: '等待人工审批' }
    gates.G8 = { status: 'pending', evidence: '等待发布' }
    const ok = Object.values(gates).every((gate) => gate.status !== 'failed')
    return { ok, gates }
  }

  private async resolveEvalGate(input: ValidationInput): Promise<GateEvidence> {
    if (input.eval) return this.evalGate(input.eval)
    const agentChange =
      input.proposal.risk?.agentBehaviorChange === true ||
      ['agent', 'knowledge'].includes(input.proposal.type) ||
      input.proposal.areas.some((area) => ['agent', 'knowledge', 'tool', 'skill'].includes(area))
    if (!agentChange) return this.na('本次变更未涉及 Agent 行为')
    if (!input.releaseId) {
      return { status: 'failed', gate: 'G5', rule: 'agent-eval-required', path: 'agent_eval_runs', howToFix: 'run agent eval for this release', error: '涉及 Agent 变更，但缺少 releaseId，无法关联评测记录' }
    }
    const runs = await this.evalService.listRuns(input.releaseId)
    if (input.modelId && !runs.some((run) => (run as { modelId?: string | null }).modelId === input.modelId)) {
      return { status: 'failed', gate: 'G5', rule: 'model-change-eval-required', path: 'agent_eval_runs.modelId', howToFix: `run eval with modelId=${input.modelId}`, error: '模型变更必须提供针对该 modelId 的评测记录' }
    }
    if (runs.length === 0) {
      return { status: 'failed', gate: 'G5', rule: 'agent-eval-required', path: 'agent_eval_runs', howToFix: 'run agent eval for this release', error: '该 Release 还没有任何评测记录' }
    }
    return this.evalGate({
      suite: runs[0].suite,
      passed: runs.reduce((sum, run) => sum + run.passed, 0),
      failed: runs.reduce((sum, run) => sum + run.failed, 0),
    })
  }

  private runCheckers(): GateEvidence {
    const root = resolveRepoRoot()
    const checker = resolve(root, 'scripts/meta/check-all.mjs')
    if (!existsSync(checker)) {
      return {
        status: 'failed',
        gate: 'G0',
        rule: 'contract-check',
        path: 'scripts/meta/check-all.mjs',
        howToFix: '确认仓库根目录存在 scripts/meta/check-all.mjs（或设置 REPO_ROOT 环境变量）',
        error: `未找到契约校验脚本：${checker}`,
      }
    }
    const result = spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20_000,
    })
    if (result.status === 0) return { status: 'passed', evidence: 'check:all exit=0' }
    return {
      status: 'failed',
      gate: 'G0',
      rule: 'contract-check',
      path: 'scripts/meta/check-all.mjs',
      howToFix: 'run npm run check:all and fix reported contract drift',
      error: (result.stderr || result.stdout || 'checker failed').slice(0, 500),
    }
  }

  private async runBlueprintCompile(blueprintId: string): Promise<GateEvidence> {
    try {
      const compiled = await this.blueprints.compile(blueprintId)
      return { status: 'passed', evidence: JSON.stringify(compiled).slice(0, 300) }
    } catch (error) {
      return { status: 'failed', gate: 'G1', rule: 'blueprint-compile', path: 'backend/src/blueprint/blueprint.service.ts#compile', howToFix: 'fix blueprint package or references', error: (error as Error).message }
    }
  }

  private permissionGate(proposal: ValidationInput['proposal']): GateEvidence {
    const permissionChange = proposal.risk?.permissionChange === true
    if (permissionChange) {
      return { status: 'passed', evidence: 'permission diff 需安全/技术负责人第二审批' }
    }
    return { status: 'passed', evidence: '无权限变化' }
  }

  private migrationGate(proposal: ValidationInput['proposal']): GateEvidence {
    const migration = proposal.risk?.migration === true
    if (!migration) return { status: 'not_applicable', notApplicableReason: '无迁移' }
    const strategy = proposal.rollbackPlan?.strategy
    if (!strategy) return { status: 'failed', error: '含迁移但缺少回退计划 strategy' }
    return { status: 'passed', evidence: `rollbackPlan=${String(strategy)}` }
  }

  private testGate(proposal: ValidationInput['proposal']): GateEvidence {
    const keys = Object.keys(proposal.testPlan ?? {})
    if (keys.length === 0) {
      return { status: 'failed', gate: 'G4', rule: 'test-plan-required', path: 'proposal.testPlan', howToFix: 'add at least one test or eval case', error: '缺少测试计划' }
    }
    if (process.env.RELEASE_G4_RUN_TESTS === 'false') {
      return { status: 'passed', evidence: `test plan: ${keys.join(',')} (G4 execution disabled by RELEASE_G4_RUN_TESTS=false)` }
    }
    const root = resolveRepoRoot()
    const jest = resolve(root, 'node_modules/jest/bin/jest.js')
    if (!existsSync(jest)) {
      return {
        status: 'failed',
        gate: 'G4',
        rule: 'test-runner-missing',
        path: 'node_modules/jest',
        howToFix: '在仓库根执行 npm install 安装测试依赖',
        error: `未找到 jest：${jest}`,
      }
    }
    const apiProject = existsSync(resolve(root, 'apps/api/package.json')) ? 'apps/api' : 'backend'
    const result = spawnSync(
      process.execPath,
      [jest, '--runInBand', '--testPathPattern=(release|proposal|agent|chat)'],
      { cwd: resolve(root, apiProject), encoding: 'utf8', timeout: 180_000 },
    )
    if (result.status === 0) {
      return { status: 'passed', evidence: `${apiProject} tests passed; plan: ${keys.join(',')}` }
    }
    return {
      status: 'failed',
      gate: 'G4',
      rule: 'backend-tests-failed',
      path: `${apiProject}/test`,
      howToFix: 'fix failing backend tests before publishing',
      error: (result.stderr || result.stdout || 'backend tests failed').slice(0, 500),
    }
  }

  private evalGate(evalInput: NonNullable<ValidationInput['eval']>): GateEvidence {
    const result = this.evalService.gate(evalInput)
    return result.ok
      ? { status: 'passed', evidence: `${evalInput.passed}/${evalInput.passed + evalInput.failed}` }
      : { status: 'failed', gate: 'G5', rule: 'agent-eval-threshold', path: 'agent_eval_runs', howToFix: 'fix agent behavior or add eval cases', error: result.reasons.join('; ') }
  }

  private na(reason: string): GateEvidence {
    return { status: 'not_applicable', notApplicableReason: reason }
  }
}
