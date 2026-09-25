import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as semver from 'semver'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  isRunnableStatus,
  staticGate,
  type AdmissionStatus as WasmAdmissionStatus,
} from '@speckit/wasm-modules'
import {
  AtomicContract,
  AtomicContractStatus,
  AtomicKind,
} from './atomic-contract.entity'
import {
  AdmissionStatus,
  AdmissionTier,
  AtomicImplementation,
  AtomicImplementationKind,
} from './atomic-implementation.entity'
import { AtomicModuleManifest } from './atomic-module-manifest.entity'
import {
  validateAtomicContract,
  validateModuleManifest,
} from './contract-validator'
import {
  checkPromotion,
  requiresReleaseEvidence,
  validateReleaseEvidence,
  type ReleaseEvidence,
} from './shadow-release'

export interface ResolvedAtomic {
  contract: AtomicContract
  implementation: AtomicImplementation
}

export interface ManifestImportResult {
  /**
   * 本次新登记的模块。带上闸 1 报告，供绑定实现时写入 `staticGate` 字段
   * （否则报告算完就丢了，绑定方只能重算）。
   */
  imported: Array<{ file: string; sha256: string; staticGate: unknown }>
  /** 哈希已登记过、跳过（幂等）。 */
  skipped: string[]
  /** 被拒的条目及原因 —— 一律不落台账。 */
  rejected: Array<{ file: string; reason: string }>
}

/**
 * 原子契约注册表。
 *
 * 三条不变量在这里落地：
 *   · 判定权在平台 —— 契约先过仓库根 schemas/atomic-contract.schema.json，不合格不收（fail-closed）
 *   · 一份判定逻辑只写一次 —— 状态流转复用 @speckit/wasm-modules 的 canPromote / isRunnableStatus
 *   · 契约与实现解耦 —— 同一契约可绑 TS 实现与 Wasm 实现，v1 只允许 calculation / query
 */
@Injectable()
export class AtomicRegistryService {
  constructor(
    @InjectRepository(AtomicContract)
    private readonly contracts: Repository<AtomicContract>,
    @InjectRepository(AtomicImplementation)
    private readonly implementations: Repository<AtomicImplementation>,
    @InjectRepository(AtomicModuleManifest)
    private readonly manifests: Repository<AtomicModuleManifest>,
  ) {}

  /** 登记契约。**先校验 Schema 再落库**：非法契约一律拒，不记录"待修"。 */
  async createContract(input: unknown): Promise<AtomicContract> {
    const validation = validateAtomicContract(input)
    if (!validation.valid) {
      throw new BadRequestException(
        `契约不符合 atomic-contract.schema.json：${validation.errors.join('; ')}`,
      )
    }

    const candidate = input as {
      atomicType: string
      version: string
      kind: AtomicKind
      description?: string
      status?: AtomicContractStatus
      inputSchema: Record<string, unknown>
      outputSchema: Record<string, unknown>
      permissions?: string[]
      errors?: string[]
      idempotency?: 'none' | 'requestId'
      cpuBudget?: number
      outputAudit?: 'off' | 'standard' | 'strict'
    }

    const existing = await this.contracts.findOne({
      where: { atomicType: candidate.atomicType, version: candidate.version },
    })
    if (existing) {
      throw new ConflictException(
        `契约已存在：${candidate.atomicType}@${candidate.version}（版本化共存要求新版本号）`,
      )
    }

    return this.contracts.save(
      this.contracts.create({
        atomicType: candidate.atomicType,
        version: candidate.version,
        kind: candidate.kind,
        description: candidate.description ?? null,
        status: candidate.status ?? AtomicContractStatus.DRAFT,
        inputSchema: candidate.inputSchema,
        outputSchema: candidate.outputSchema,
        permissions: candidate.permissions ?? [],
        errors: candidate.errors ?? [],
        idempotency: candidate.idempotency ?? 'none',
        // 未声明即按 standard；闸 3 的判据文本见 docs/protocols/atomic-output-audit.md
        outputAudit: candidate.outputAudit ?? 'standard',
        // bigint 列在 TypeORM 里以字符串返回；这里统一存字符串避免精度问题
        cpuBudget:
          candidate.cpuBudget === undefined ? null : String(candidate.cpuBudget),
      }),
    )
  }

  /** 列出契约（可按 atomicType 过滤），供管理界面与审计排查。 */
  async list(atomicType?: string): Promise<AtomicContract[]> {
    return this.contracts.find({
      where: atomicType ? { atomicType } : {},
      order: { atomicType: 'ASC', version: 'DESC' },
    })
  }

  /**
   * 按语义化范围解析可执行的原子。
   *
   * 解析不出可执行实现时**不回落到任何内置逻辑** —— 返回 404，
   * 由调用方决定如何提示（元语不变量 4：fail-closed 且不静默回退）。
   */
  async resolve(atomicType: string, range: string): Promise<ResolvedAtomic> {
    const contracts = await this.contracts.find({
      where: { atomicType, status: AtomicContractStatus.ACTIVE },
    })
    if (contracts.length === 0) {
      throw new NotFoundException(`没有 active 的契约：${atomicType}`)
    }

    const versions = contracts.map((c) => c.version)
    const picked = semver.maxSatisfying(versions, range, {
      includePrerelease: false,
    })
    if (!picked) {
      throw new NotFoundException(
        `没有满足 ${range} 的版本：${atomicType}（现有 ${versions.join(', ')}）`,
      )
    }
    const contract = contracts.find((c) => c.version === picked) as AtomicContract

    const implementations = await this.implementations.find({
      where: { atomicContractId: contract.id },
    })
    const runnable = implementations.find((impl) =>
      isRunnableStatus(impl.status as unknown as WasmAdmissionStatus),
    )
    if (!runnable) {
      throw new NotFoundException(
        `契约 ${atomicType}@${picked} 没有可执行的实现（状态须为 shadow / canary / active）`,
      )
    }
    return { contract, implementation: runnable }
  }

  /**
   * 绑定实现。Wasm 实现必须能指认"客户同意跑的那一份代码"：
   * 模块哈希 + ABI 版本 + 准入层级；Tier B 还必须带审查背书与复现构建引用。
   */
  async bindImplementation(
    contractId: string,
    input: {
      kind: AtomicImplementationKind
      moduleSha256?: string
      abiVersion?: number
      tier?: AdmissionTier
      review?: Record<string, unknown>
      reproducibleBuildRef?: string
      sourceGate?: Record<string, unknown>
      staticGate?: Record<string, unknown>
      status?: AdmissionStatus
    },
  ): Promise<AtomicImplementation> {
    const contract = await this.contracts.findOne({
      where: { id: contractId },
    })
    if (!contract) {
      throw new NotFoundException(`契约不存在：${contractId}`)
    }

    if (input.kind === AtomicImplementationKind.WASM) {
      if (!input.moduleSha256 || !/^[0-9a-f]{64}$/.test(input.moduleSha256)) {
        throw new BadRequestException(
          'Wasm 实现必须提供 64 位 hex 的 moduleSha256（无法指认模块即不得绑定）',
        )
      }
      if (input.abiVersion !== 1) {
        throw new BadRequestException('ABI 版本必须为 1')
      }
      if (!input.tier) {
        throw new BadRequestException('Wasm 实现必须声明准入层级（A / B）')
      }
      if (
        input.tier === AdmissionTier.B &&
        (!input.review || !input.reproducibleBuildRef)
      ) {
        throw new BadRequestException(
          'Tier B 必须带审查背书与复现构建引用（不得绑定来路不明的模块）',
        )
      }
    }

    // ── 闸 4：首次绑定不得直接落在可运行状态 ──────────────────────────
    // 判据走 `shadow-release.ts`（唯一实现），这里只把结论变成错误消息。
    // 注意：`sourceGate` / `staticGate` / `reproducibleBuildRef` 可以随绑定一起传入 ——
    // 它们是控制面自己跑闸的产物（admit-cli），不是客户能编的东西；
    // 而影子/灰度记录**只能**来自 `recordReleaseEvidence`（平台记录），不接受随请求传入。
    const targetStatus = input.status ?? AdmissionStatus.SUBMITTED
    // `submitted` 是**起点**，不是一次流转（所以不拿它去问状态机）；
    // 别的状态都得从起点一步一步走上来。
    const promotion =
      targetStatus === AdmissionStatus.SUBMITTED
        ? { allowed: true as const }
        : checkPromotion(AdmissionStatus.SUBMITTED, targetStatus, {
            sourceGate: input.sourceGate,
            staticGate: input.staticGate,
            reproducibleBuildRef: input.reproducibleBuildRef,
            review: input.review,
          })
    if (!promotion.allowed) {
      throw new BadRequestException(
        `绑定被闸 4 拒绝[${promotion.code}]：${promotion.detail}` +
          (promotion.missing?.length ? `；缺少：${promotion.missing.join('、')}` : ''),
      )
    }

    return this.implementations.save(
      this.implementations.create({
        atomicContractId: contractId,
        kind: input.kind,
        moduleSha256: input.moduleSha256 ?? null,
        abiVersion: input.abiVersion ?? null,
        tier: input.tier ?? null,
        review: input.review ?? null,
        reproducibleBuildRef: input.reproducibleBuildRef ?? null,
        sourceGate: input.sourceGate ?? null,
        staticGate: input.staticGate ?? null,
        status: input.status ?? AdmissionStatus.SUBMITTED,
      }),
    )
  }

  /** 状态流转校验：复用 wasm-modules 的状态机，不另造一套。 */
  assertTransitionAllowed(from: AdmissionStatus, to: AdmissionStatus): void {
    // 状态机（canPromote）与证据门（闸 4）都走 shadow-release 那一份判定
    const check = checkPromotion(from, to, {})
    if (!check.allowed && check.code !== 'EVIDENCE_MISSING') {
      throw new BadRequestException(`不允许的状态流转：${from} → ${to}（${check.detail}）`)
    }
  }

  async promoteImplementation(
    implementationId: string,
    to: AdmissionStatus,
  ): Promise<AtomicImplementation> {
    const impl = await this.implementations.findOne({
      where: { id: implementationId },
    })
    if (!impl) {
      throw new NotFoundException(`实现不存在：${implementationId}`)
    }

    // ── 闸 4：证据门 ─────────────────────────────────────────────
    // 证据取自**实体列**（平台记录），不看调用方参数 —— 这是"不得自证"的落地方式。
    const evidence = (impl.releaseEvidence ?? {}) as ReleaseEvidence
    const check = checkPromotion(impl.status, to, evidence)
    if (!check.allowed) {
      throw new BadRequestException(
        `晋升被闸 4 拒绝[${check.code}]：${check.detail}` +
          (check.missing?.length ? `；缺少：${check.missing.join('、')}` : ''),
      )
    }

    impl.status = to
    return this.implementations.save(impl)
  }

  /**
   * 记录闸 4 的证据（**平台侧**动作：影子运行器 / 灰度运行器 / 人工审查结论）。
   *
   * 它没有对外的 HTTP 入口是刻意的吗？不 —— 有入口，但挂在控制面权限点上（见
   * `atomic-runtime.controller` 的 `release-evidence` 端点）。关键不在"谁能调"，
   * 而在"证据一旦写进这一列，晋升判定就只看这一列"：调用方在晋升请求里塞字段没用。
   */
  async recordReleaseEvidence(
    implementationId: string,
    patch: ReleaseEvidence,
  ): Promise<AtomicImplementation> {
    const impl = await this.implementations.findOne({
      where: { id: implementationId },
    })
    if (!impl) {
      throw new NotFoundException(`实现不存在：${implementationId}`)
    }

    const errors = validateReleaseEvidence(patch)
    if (errors.length > 0) {
      throw new BadRequestException(`证据形状不合法：${errors.join('；')}`)
    }

    impl.releaseEvidence = {
      ...((impl.releaseEvidence ?? {}) as ReleaseEvidence),
      ...patch,
    }
    return this.implementations.save(impl)
  }

  /**
   * 一次性补录：闸 4 上线**之前**就已经在跑的实现。
   *
   * 为什么不直接放行：那等于闸 4 从第一天就漏。补录必须留下理由与决定人，
   * 并且能被查出来（`listGrandfathered()`）——"隐形的例外"才是真正危险的东西。
   */
  async grandfatherImplementation(
    implementationId: string,
    input: { reason: string; decidedBy: string; status?: AdmissionStatus },
  ): Promise<AtomicImplementation> {
    const impl = await this.implementations.findOne({
      where: { id: implementationId },
    })
    if (!impl) {
      throw new NotFoundException(`实现不存在：${implementationId}`)
    }
    const existing = (impl.releaseEvidence ?? {}) as ReleaseEvidence
    if (existing.grandfather) {
      throw new BadRequestException(
        `该实现已补录过（${existing.grandfather.decidedBy}：${existing.grandfather.reason}）—— 补录只能做一次`,
      )
    }
    const errors = validateReleaseEvidence({
      grandfather: { ...input, at: new Date().toISOString() },
    })
    if (errors.length > 0) {
      throw new BadRequestException(`补录记录不完整：${errors.join('；')}`)
    }

    impl.releaseEvidence = {
      ...existing,
      grandfather: {
        reason: input.reason,
        decidedBy: input.decidedBy,
        at: new Date().toISOString(),
      },
    }
    impl.status = input.status ?? AdmissionStatus.ACTIVE
    return this.implementations.save(impl)
  }

  /** 哪些实现是靠补录放行的（上线后的必查项）。 */
  async listGrandfathered(): Promise<AtomicImplementation[]> {
    const all = await this.implementations.find({})
    return all.filter(
      (impl) => ((impl.releaseEvidence ?? {}) as ReleaseEvidence).grandfather !== undefined,
    )
  }

  /**
   * 导入模块清单（`wasm-modules/build/manifest.json`）。
   *
   * 判定权在平台（元语不变量 3）：**清单自述的一切都不可信** ——
   *   · 对模块字节重算 SHA-256，与声明不符即拒
   *   · 自行跑一次闸 1 静态白名单（不采信清单里的 staticGate 报告）
   *   · 字节数取实测值，不用 entry.sizeBytes
   * 被拒条目一律**不落台账**；同哈希重复导入幂等跳过。
   */
  async importManifest(
    manifestPath: string,
    importedBy: string,
  ): Promise<ManifestImportResult> {
    if (!existsSync(manifestPath)) {
      throw new NotFoundException(`清单不存在：${manifestPath}`)
    }

    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch (error) {
      throw new BadRequestException(
        `清单解析失败（解析不动一律拒）：${(error as Error).message}`,
      )
    }

    const schemaCheck = validateModuleManifest(raw)
    if (!schemaCheck.valid) {
      throw new BadRequestException(
        `清单不符合 atomic-module-manifest.schema.json：${schemaCheck.errors.join('; ')}`,
      )
    }

    const manifest = raw as {
      modules: Array<{
        atomicType: string
        file: string
        tier: AdmissionTier
        sha256: string
      }>
    }
    const dir = dirname(manifestPath)
    const result: ManifestImportResult = {
      imported: [],
      skipped: [],
      rejected: [],
    }

    for (const entry of manifest.modules) {
      const filePath = join(dir, entry.file)
      if (!existsSync(filePath)) {
        result.rejected.push({ file: entry.file, reason: '模块文件不存在' })
        continue
      }

      const bytes = new Uint8Array(readFileSync(filePath))
      const actualSha256 = createHash('sha256').update(bytes).digest('hex')
      if (actualSha256 !== entry.sha256) {
        result.rejected.push({
          file: entry.file,
          reason: `字节哈希与清单声明不符：实测 ${actualSha256} ≠ 声明 ${entry.sha256}`,
        })
        continue
      }

      let gateReport: unknown
      try {
        gateReport = staticGate(bytes)
      } catch (error) {
        result.rejected.push({
          file: entry.file,
          reason: `静态闸复检不通过：${(error as Error).message}`,
        })
        continue
      }

      const existing = await this.manifests.findOne({
        where: { sha256: actualSha256 },
      })
      if (existing) {
        result.skipped.push(entry.file)
        continue
      }

      await this.manifests.save(
        this.manifests.create({
          atomicType: entry.atomicType,
          file: entry.file,
          sha256: actualSha256,
          tier: entry.tier,
          sizeBytes: bytes.length,
          importedBy,
          manifestSnapshot: entry as unknown as Record<string, unknown>,
        }),
      )
      result.imported.push({
        file: entry.file,
        sha256: actualSha256,
        staticGate: gateReport,
      })
    }

    return result
  }
}
