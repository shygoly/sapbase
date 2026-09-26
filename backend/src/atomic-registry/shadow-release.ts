/**
 * 闸 4：影子发布的证据门。
 *
 * 状态机本身早已存在（`@speckit/wasm-modules` 的 `canPromote`：`submitted → built →
 * tested → shadow → canary → active`，不得跳级）。缺的是**门**：
 * 原来的 `bindImplementation` 可以带着 `status: 'active'` 直接创建一条实现记录 ——
 * 于是"不得跳级"只写在文档里，平台没在拦。
 *
 * 本模块是闸 4 判据的唯一实现。三条硬约束：
 *
 *   1. **不得跳级**：只能在 `canPromote` 允许的下一步里走。
 *   2. **不得自证**：证据必须是**平台记录**的（`releaseEvidence` 列，由控制面写入），
 *      调用方在请求体里塞再多的字段也不算数 —— 判据只看列里的东西。
 *   3. **吊销始终可达**：安全动作永远不被闸挡住。
 */
import { AdmissionStatus } from './atomic-implementation.entity'
import { canPromote, type AdmissionStatus as WasmAdmissionStatus } from '@speckit/wasm-modules'

/** 需要证据的"可运行/可释放"阶段。 */
export type ReleaseStage = 'shadow' | 'canary' | 'active'

export interface ShadowEvidence {
  /** 与谁并行对照 —— "影子"必须有对照物，否则只是又跑了一遍。 */
  parallelWith: string
  startedAt: string
  observedInvocations: number
  differingResults: number
  /** 已逐条审查的差异数（未审查的差异不允许放行）。 */
  reviewedDiffs?: number
}

export interface CanaryEvidence {
  startedAt: string
  observedInvocations: number
  differingResults: number
  reviewedDiffs?: number
}

export interface ReleaseEvidence {
  sourceGate?: unknown
  staticGate?: unknown
  reproducibleBuildRef?: string
  review?: unknown
  shadow?: ShadowEvidence
  canary?: CanaryEvidence
  /**
   * 早于闸 4 的一次性补录。
   *
   * 为什么必须有这个口子：闸 4 上线时，库里已经有 `active` 的实现。要么把它们
   * 静默放行（等于闸 4 从第一天就漏），要么提供一条**显式、可查、带理由**的补录路径。
   * 它只能由平台侧写入，且写入后能被查出来（"哪些实现是补录的"是一个必查项）。
   */
  grandfather?: { reason: string; decidedBy: string; at: string }
}

export type PromotionDenialCode =
  | 'TRANSITION_NOT_ALLOWED'
  | 'TERMINAL_STATUS'
  | 'EVIDENCE_MISSING'

export interface PromotionCheck {
  allowed: boolean
  /** 允许时的说明（如"吊销不受闸 4 限制"）。 */
  detail?: string
  code?: PromotionDenialCode
  /** 缺哪些证据（逐条列出，不给一句"证据不足"）。 */
  missing?: string[]
}

const TERMINAL: AdmissionStatus[] = [AdmissionStatus.REJECTED, AdmissionStatus.REVOKED]

/** 非空计数：`undefined` / 负数都算 0。 */
function count(value: number | undefined): number {
  return typeof value === 'number' && value > 0 ? value : 0
}

/** 影子/灰度记录是否"干净"：差异必须都审查过。 */
function unreviewed(run: { differingResults: number; reviewedDiffs?: number }): number {
  return count(run.differingResults) - count(run.reviewedDiffs)
}

/**
 * 走向目标阶段需要什么证据（缺一项都不行）。
 *
 * 判据写得具体到字段，是为了让"被拒绝"这件事可操作：调用方拿到的是
 * "缺 shadow 记录（parallelWith 不能为空）"，而不是"证据不足"。
 */
function requiredEvidenceFor(
  target: AdmissionStatus,
  evidence: ReleaseEvidence,
): string[] {
  const missing: string[] = []
  const shadow = evidence.shadow

  switch (target) {
    case 'built':
      if (!evidence.sourceGate) missing.push('sourceGate（闸 0 源码预检报告）')
      break
    case 'tested':
      if (!evidence.staticGate) missing.push('staticGate（闸 1 静态白名单报告）')
      if (!evidence.reproducibleBuildRef) {
        missing.push('reproducibleBuildRef（闸 2 复现构建引用）')
      }
      break
    case 'shadow':
      if (!shadow) {
        missing.push('shadow 记录（影子运行：与谁并行、观测了多少次、差异多少）')
        break
      }
      if (!shadow.parallelWith) missing.push('shadow.parallelWith（影子必须有对照物）')
      if (!shadow.startedAt) missing.push('shadow.startedAt')
      if (count(shadow.observedInvocations) === 0) {
        missing.push('shadow.observedInvocations（没有观测记录的影子期不算影子期）')
      }
      break
    case 'canary':
      if (!shadow) {
        missing.push('shadow 记录（晋灰度前必须有一段干净影子期）')
      } else if (unreviewed(shadow) !== 0) {
        missing.push(
          `shadow 差异未审查（差异 ${count(shadow.differingResults)} 条，已审查 ${count(shadow.reviewedDiffs)} 条）`,
        )
      }
      if (!evidence.canary) {
        missing.push('canary 记录（灰度运行：观测次数与差异数）')
      } else if (count(evidence.canary.observedInvocations) === 0) {
        missing.push('canary.observedInvocations')
      }
      break
    case 'active':
      if (!evidence.canary) {
        missing.push('canary 记录（晋全量前必须有一段干净灰度期）')
      } else if (unreviewed(evidence.canary) !== 0) {
        missing.push(
          `canary 差异未审查（差异 ${count(evidence.canary.differingResults)} 条，已审查 ${count(evidence.canary.reviewedDiffs)} 条）`,
        )
      }
      break
    default:
      break
  }
  return missing
}

/**
 * 闸 4 判定：能不能从 `from` 走到 `to`。
 *
 * 判定顺序是刻意的：先安全动作（吊销/回退）→ 再终态 → 再跳级 → 最后证据。
 * 这样"被拒"的原因永远是**最根本的那一条**，而不会用"缺证据"掩盖"你想跳级"。
 */
export function checkPromotion(
  from: AdmissionStatus,
  to: AdmissionStatus,
  evidence: ReleaseEvidence,
): PromotionCheck {
  // 1. 安全动作永远可达：吊销与"登记为不合格"不受闸 4 限制
  if (to === 'revoked') return { allowed: true, detail: '吊销不受闸 4 限制（安全动作永远可达）' }
  if (to === 'rejected') return { allowed: true, detail: '标记为不合格不受闸 4 限制' }

  // 2. 终态只能出、不能再进
  if (TERMINAL.includes(from)) {
    return {
      allowed: false,
      code: 'TERMINAL_STATUS',
      detail: `${from} 是终态：重新提交必须走新记录，不能把旧记录"复活"`,
    }
  }

  // 3. 补录（闸 4 上线前的存量实现）：显式记录即可通行，理由与决定人都在证据里
  if (evidence.grandfather) {
    return {
      allowed: true,
      detail: `一次性补录（${evidence.grandfather.decidedBy}：${evidence.grandfather.reason}）`,
    }
  }

  // 4. 不得跳级（含同状态重入）
  //
  // 状态机**不在这里**：复用 `@speckit/wasm-modules` 的 `canPromote`（元语不变量 12）。
  // 自己抄一份 NEXT_STATUS 就等于造了第二份真源，两份漂移的那一刻闸就漏了。
  if (!canPromote(from as unknown as WasmAdmissionStatus, to as unknown as WasmAdmissionStatus)) {
    return {
      allowed: false,
      code: 'TRANSITION_NOT_ALLOWED',
      detail:
        `不允许的流转：${from} → ${to}` +
        '（准入闸必须逐级过：submitted → built → tested → shadow → canary → active；' +
        '回退或重来请用吊销 + 重新绑定的路径）',
    }
  }

  // 5. 证据门
  const missing = requiredEvidenceFor(to, evidence)
  if (missing.length > 0) {
    return {
      allowed: false,
      code: 'EVIDENCE_MISSING',
      detail: `晋 ${to} 缺少 ${missing.length} 项证据`,
      missing,
    }
  }

  return { allowed: true }
}

/** 目标阶段是否需要闸 4 的证据门（其余阶段只受状态机约束）。 */
export function requiresReleaseEvidence(target: AdmissionStatus): boolean {
  return (['shadow', 'canary', 'active'] as AdmissionStatus[]).includes(target)
}

/**
 * 校验一份**平台侧**记录进来的证据形状。
 *
 * 为什么放在这里而不是靠 Schema：这份证据不进任何对外协议（它是控制面自己的记录），
 * 但它是闸 4 的输入 —— 输入的形状坏了，判据就会给出"看起来通过"的结论。
 */
export function validateReleaseEvidence(patch: ReleaseEvidence): string[] {
  const errors: string[] = []
  const nonNegative = (value: number | undefined, name: string) => {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      errors.push(`${name} 必须是非负整数`)
    }
  }

  if (patch.shadow) {
    if (!patch.shadow.parallelWith) errors.push('shadow.parallelWith 不能为空（影子必须有对照物）')
    if (!patch.shadow.startedAt) errors.push('shadow.startedAt 不能为空')
    nonNegative(patch.shadow.observedInvocations, 'shadow.observedInvocations')
    nonNegative(patch.shadow.differingResults, 'shadow.differingResults')
    nonNegative(patch.shadow.reviewedDiffs, 'shadow.reviewedDiffs')
  }
  if (patch.canary) {
    if (!patch.canary.startedAt) errors.push('canary.startedAt 不能为空')
    nonNegative(patch.canary.observedInvocations, 'canary.observedInvocations')
    nonNegative(patch.canary.differingResults, 'canary.differingResults')
    nonNegative(patch.canary.reviewedDiffs, 'canary.reviewedDiffs')
  }
  if (patch.grandfather) {
    if (!patch.grandfather.reason) errors.push('grandfather.reason 不能为空（补录必须写明理由）')
    if (!patch.grandfather.decidedBy) errors.push('grandfather.decidedBy 不能为空')
  }
  return errors
}
