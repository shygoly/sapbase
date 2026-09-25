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
  canPromote,
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
    const allowed = canPromote(
      from as unknown as WasmAdmissionStatus,
      to as unknown as WasmAdmissionStatus,
    )
    if (!allowed) {
      throw new BadRequestException(
        `不允许的状态流转：${from} → ${to}（准入状态不得跳闸；rejected / revoked 为终态）`,
      )
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
    this.assertTransitionAllowed(impl.status, to)
    impl.status = to
    return this.implementations.save(impl)
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
