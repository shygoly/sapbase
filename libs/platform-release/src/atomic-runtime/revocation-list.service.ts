import { Inject, Injectable, Logger } from '@nestjs/common'
import { readFileSync, existsSync } from 'node:fs'
import {
  EMPTY_REVOCATION_LIST,
  mergeRevocationList,
  type RevocationList,
  type RevocationReason,
} from '@speckit/wasm-modules'

/** 吊销名单文件路径的注入令牌。 */
export const REVOCATION_LIST_PATH = Symbol('REVOCATION_LIST_PATH')

const REASONS: readonly RevocationReason[] = [
  'security-incident',
  'failed-shadow',
  'reproducibility-lost',
  'vendor-withdrawn',
  'superseded',
  'other',
]

/**
 * 解析并校验吊销名单。
 *
 * 解析不动一律拒（与准入闸同一个态度）：形状不对的名单**绝不能**被当成"没有吊销"。
 */
export function parseRevocationList(raw: unknown): RevocationList {
  if (!raw || typeof raw !== 'object') {
    throw new Error('吊销名单必须是 JSON 对象')
  }
  const list = raw as { version?: unknown; issuedAt?: unknown; revoked?: unknown }
  if (typeof list.version !== 'number' || !Number.isFinite(list.version)) {
    throw new Error('吊销名单缺少数值型 version')
  }
  if (!Array.isArray(list.revoked)) {
    throw new Error('吊销名单缺少 revoked 数组')
  }
  const revoked = list.revoked.map((entry, index) => {
    const item = entry as Record<string, unknown>
    if (typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(item.sha256)) {
      throw new Error(`第 ${index} 条吊销记录的 sha256 非法（须 64 hex）`)
    }
    if (!REASONS.includes(item.reason as RevocationReason)) {
      throw new Error(`第 ${index} 条吊销记录的 reason 非法：${String(item.reason)}`)
    }
    if (typeof item.revokedAt !== 'string' || typeof item.revokedBy !== 'string') {
      throw new Error(`第 ${index} 条吊销记录缺少 revokedAt / revokedBy`)
    }
    return {
      sha256: (item.sha256 as string).toLowerCase(),
      reason: item.reason as RevocationReason,
      revokedAt: item.revokedAt,
      revokedBy: item.revokedBy,
      detail: typeof item.detail === 'string' ? item.detail : undefined,
    }
  })

  return {
    version: list.version,
    issuedAt:
      typeof list.issuedAt === 'string'
        ? list.issuedAt
        : new Date().toISOString(),
    revoked,
  }
}

export interface RevocationListState {
  list: RevocationList
  /** 名单来源是否可用（false = 从未成功载入过，按部署策略决定是否放行）。 */
  loaded: boolean
  lastError?: string
}

/**
 * 吊销名单的本地同步。
 *
 * 三条设计取向（对应 design.md 的吊销小节）：
 *   1. **版本单调**：只接受更高版本的名单 —— 防止用旧名单回放把吊销"撤销"掉。
 *   2. **解析不动即拒**：形状非法的名单不放行，保留上一次已知良好的名单。
 *   3. **名单缺失 ≠ 未吊销**：从未成功载入时 `loaded=false`，由调用方按部署策略决定
 *      （本实现记录警告并继续，因为 v1 的名单是本地文件，缺失属配置问题而非攻击面）。
 */
@Injectable()
export class RevocationListService {
  private readonly logger = new Logger(RevocationListService.name)
  private state: RevocationListState = {
    list: EMPTY_REVOCATION_LIST,
    loaded: false,
  }

  constructor(
    @Inject(REVOCATION_LIST_PATH) private readonly listPath: string,
  ) {}

  /** 读取最新名单并按版本合并。任何异常都不会让旧名单失效。 */
  refresh(): RevocationListState {
    if (!existsSync(this.listPath)) {
      this.state = {
        ...this.state,
        loaded: false,
        lastError: `吊销名单文件不存在：${this.listPath}`,
      }
      this.logger.warn(this.state.lastError)
      return this.state
    }

    try {
      const incoming = parseRevocationList(
        JSON.parse(readFileSync(this.listPath, 'utf8')),
      )
      const previous = this.state.list
      const merged = mergeRevocationList(previous, incoming)
      if (merged === previous && incoming.version <= previous.version) {
        this.logger.warn(
          `忽略版本未增长的吊销名单（收到 v${incoming.version}，当前 v${previous.version}）——防回放`,
        )
      }
      this.state = { list: merged, loaded: true }
      return this.state
    } catch (error) {
      // fail-closed：保留旧名单，不因一份坏文件而"看起来没有吊销"
      this.state = {
        ...this.state,
        lastError: (error as Error).message,
      }
      this.logger.error(`吊销名单载入失败（保留上一版）：${this.state.lastError}`)
      return this.state
    }
  }

  /** 当前生效的名单（含"是否载入过"的状态）。 */
  current(): RevocationListState {
    return this.state
  }
}
