import type { SemanticEntity } from './record-validator'
import { RecordWriteError } from './record-write-error'
import { resolveState, type DocumentEntity } from './document-writer'

export function allowedTargetsOf(entity: SemanticEntity, from: string): string[] {
  return (entity.transitions ?? []).filter((item) => item.from === from).map((item) => item.to)
}

/**
 * 升级后按当前模板判定：记录的当前 state 必须仍被声明。
 * 旧模板状态在当前模板里不存在 → 显式拒绝，不静默当成初始态。
 */
export function assertRecordStateDeclared(
  entity: DocumentEntity,
  recordState: string | null | undefined,
): void {
  if (recordState == null || recordState === '') return
  const names = (entity.states ?? []).map((state) => state.name)
  if (!names.includes(recordState)) {
    throw new RecordWriteError(
      `该行处于旧模板状态 ${recordState}，当前模板未声明`,
      'legacy-state',
      'state',
    )
  }
}

export function assertTransitionLegal(
  entity: DocumentEntity,
  recordState: string | null | undefined,
  to: string,
): { from: string } {
  if (!entity.states || entity.states.length === 0) {
    throw new RecordWriteError(`实体 ${entity.name} 未声明状态，不允许迁移`, 'invalid-transition')
  }
  const stateNames = entity.states.map((state) => state.name)
  if (!stateNames.includes(to)) {
    throw new RecordWriteError(`状态 ${to} 未被实体 ${entity.name} 声明`, 'invalid-transition', 'to')
  }
  const from = resolveState(recordState, entity)
  if (!from) {
    throw new RecordWriteError(`实体 ${entity.name} 没有初始状态，无法迁移`, 'invalid-transition')
  }
  const allowed = allowedTargetsOf(entity, from)
  if (!allowed.includes(to)) {
    throw new RecordWriteError(
      `非法迁移：${entity.name} 当前状态 ${from} → ${to}；该实体允许的目标：${allowed.join(', ') || '（无）'}`,
      'invalid-transition',
    )
  }
  return { from }
}
