/**
 * Atomic Registry API Service
 * 原子契约与运行时接入（见 openspec/changes/add-wasm-atomic-runtime）
 *
 * 约定：
 * · 调用返回的是**真实 Wasm 原子**在零能力沙箱里的计算结果；
 * · 失败不会回退到任何内置实现 —— 后端会返回明确的 code（如 MODULE_REVOKED / PERMISSION_DENIED），
 *   调用方应把它当错误处理，而不是当"另一种结果"。
 */

import { httpClient } from './client'

export interface AtomicContractView {
  id: string
  atomicType: string
  version: string
  kind: 'calculation' | 'query'
  status: 'draft' | 'active' | 'deprecated'
  description?: string | null
  permissions: string[]
  errors: string[]
}

export interface AtomicInvocationResult {
  atomicType: string
  contractVersion: string
  moduleSha256: string
  rows: number
  columns: Record<string, number[]>
  total?: number
  elapsedMs: number
  gateChecks: string[]
}

export interface ManifestImportResult {
  imported: Array<{ file: string; sha256: string }>
  skipped: string[]
  rejected: Array<{ file: string; reason: string }>
}

export const atomicApi = {
  /** 列出原子契约（可按 atomicType 过滤） */
  async listContracts(atomicType?: string): Promise<AtomicContractView[]> {
    const response = await httpClient.get<AtomicContractView[]>(
      '/api/atomic-contracts',
      { params: atomicType ? { atomicType } : undefined },
    )
    return response.data
  },

  /**
   * 调用原子。
   *
   * records 的字段名对应契约 inputSchema.columns[].source 的最后一段
   * （例如 source `$line.onHand` → 传 `{ onHand: 10 }`）。
   * 标识类字段（物料号、单据号）不应出现在这里：它们不进入模块，
   * 由调用方自己按行序回填。
   */
  async invoke(
    atomicType: string,
    version: string,
    records: Array<Record<string, number>>,
    options?: { timeoutMs?: number },
  ): Promise<AtomicInvocationResult> {
    const response = await httpClient.post<AtomicInvocationResult>(
      `/api/atomic-contracts/${encodeURIComponent(atomicType)}/invoke`,
      { version, records, ...options },
    )
    return response.data
  },

  /** 导入模块清单（后端会重算哈希，不采信清单自述值） */
  async importManifest(path: string): Promise<ManifestImportResult> {
    const response = await httpClient.post<ManifestImportResult>(
      '/api/atomic-contracts/import',
      { path },
    )
    return response.data
  },
}
