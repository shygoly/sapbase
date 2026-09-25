import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AtomicExecutor } from './atomic-executor.service'
import { AtomicRuntimeError, toHttpError } from './atomic-runtime.error'
import { RevocationListService } from './revocation-list.service'
import type { ReleaseEvidence } from '../atomic-registry/shadow-release'
import { AdmissionStatus } from '../atomic-registry/atomic-implementation.entity'

interface AuthedRequest {
  user?: {
    id?: string
    userId?: string
    email?: string
    organizationId?: string
    permissions?: string[]
  }
}

/**
 * 原子注册表与运行时接入。
 *
 * 设计约定（v3 §5.2 / design.md）：
 *   GET  /api/atomic-contracts              列出契约
 *   POST /api/atomic-contracts              登记契约（先过 Schema）
 *   POST /api/atomic-contracts/import       导入模块清单（重算哈希 + 闸 1 复检）
 *   POST /api/atomic-contracts/:type/invoke 调用原子（真实执行 Wasm）
 */
@ApiTags('Atomic Registry')
@Controller('atomic-contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AtomicRuntimeController {
  constructor(
    private readonly registry: AtomicRegistryService,
    private readonly executor: AtomicExecutor,
    private readonly auditLogs: AuditLogsService,
    private readonly revocations: RevocationListService,
  ) {}

  @Get()
  @ApiOperation({ summary: '列出原子契约' })
  async list(@Query('atomicType') atomicType?: string) {
    return this.registry.list(atomicType)
  }

  @Post()
  @ApiOperation({ summary: '登记原子契约（不合法一律拒）' })
  async create(@Body() body: unknown) {
    return this.registry.createContract(body)
  }

  @Post('import')
  @ApiOperation({ summary: '导入模块清单（重算哈希，不采信清单自述）' })
  async importManifest(
    @Body() body: { path?: string },
    @Request() req: AuthedRequest,
  ) {
    const manifestPath = body?.path
    if (!manifestPath) {
      throw new HttpException(
        { statusCode: 400, code: 'INVALID_INPUT', message: '缺少 path（清单文件路径）' },
        400,
      )
    }
    return this.registry.importManifest(
      manifestPath,
      req.user?.email ?? req.user?.userId ?? 'unknown',
    )
  }

  @Post(':contractId/implementations')
  @ApiOperation({
    summary: '把实现绑定到契约（控制面动作；闸 4 在这里拦"直接绑成可运行状态"）',
  })
  async bindImplementation(
    @Param('contractId') contractId: string,
    @Body()
    body: {
      kind: 'typescript' | 'wasm'
      moduleSha256?: string
      abiVersion?: number
      tier?: 'A' | 'B'
      review?: Record<string, unknown>
      reproducibleBuildRef?: string
      sourceGate?: Record<string, unknown>
      staticGate?: Record<string, unknown>
      status?: AdmissionStatus
    },
  ) {
    const impl = await this.registry.bindImplementation(contractId, body as never)
    return {
      id: impl.id,
      status: impl.status,
      moduleSha256: impl.moduleSha256,
      releaseEvidence: impl.releaseEvidence,
    }
  }

  @Post('implementations/:id/promote')
  @ApiOperation({
    summary: '推进准入状态（闸 4：逐级过、每级都要平台记录的证据）',
  })
  async promote(
    @Param('id') id: string,
    @Body() body: { to?: AdmissionStatus },
  ) {
    if (!body?.to) {
      throw new HttpException(
        { statusCode: 400, code: 'INVALID_INPUT', message: '缺少 to（目标准入状态）' },
        400,
      )
    }
    const impl = await this.registry.promoteImplementation(id, body.to)
    return { id: impl.id, status: impl.status, releaseEvidence: impl.releaseEvidence }
  }

  @Post('implementations/:id/release-evidence')
  @ApiOperation({
    summary: '记录闸 4 证据（平台侧：影子/灰度运行结果），晋升判定只认这一列',
  })
  async recordReleaseEvidence(
    @Param('id') id: string,
    @Body() body: ReleaseEvidence,
  ) {
    const impl = await this.registry.recordReleaseEvidence(id, body ?? {})
    return { id: impl.id, status: impl.status, releaseEvidence: impl.releaseEvidence }
  }

  @Post('implementations/:id/grandfather')
  @ApiOperation({
    summary: '一次性补录：把早于闸 4 的存量实现显式标记放行（必须写明理由与决定人）',
  })
  async grandfather(
    @Param('id') id: string,
    @Body() body: { reason?: string; decidedBy?: string; status?: AdmissionStatus },
  ) {
    if (!body?.reason || !body?.decidedBy) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: '补录必须写明 reason 与 decidedBy（隐形的例外才是真正危险的东西）',
        },
        400,
      )
    }
    const impl = await this.registry.grandfatherImplementation(id, {
      reason: body.reason,
      decidedBy: body.decidedBy,
      status: body.status,
    })
    return { id: impl.id, status: impl.status, releaseEvidence: impl.releaseEvidence }
  }

  @Get('implementations/grandfathered')
  @ApiOperation({ summary: '哪些实现是靠一次性补录放行的（上线后的必查项）' })
  async grandfathered() {
    const impls = await this.registry.listGrandfathered()
    return impls.map((impl) => ({
      id: impl.id,
      status: impl.status,
      moduleSha256: impl.moduleSha256,
      releaseEvidence: impl.releaseEvidence,
    }))
  }

  @Post(':atomicType/invoke')
  // 调用是计算，不是创建资源：显式 200，避免 Nest 的 POST 默认 201
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '调用原子（零能力沙箱内执行真实 Wasm）' })
  async invoke(
    @Param('atomicType') atomicType: string,
    @Body()
    body: {
      version?: string
      records?: Array<Record<string, number>>
      timeoutMs?: number
    },
    @Request() req: AuthedRequest,
  ) {
    const actor = req.user?.email ?? req.user?.userId ?? 'unknown'
    // AuditLog 是租户实体（organizationId 非空）：没有组织上下文就没法留痕，
    // 此时**拒绝调用**而不是写一条残缺审计（元语不变量 4：fail-closed）。
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: '缺少组织上下文（organizationId），无法记录审计，拒绝执行',
        },
        400,
      )
    }
    const version = body?.version ?? '*'
    const records = body?.records ?? []
    const startedAt = Date.now()

    try {
      const result = await this.executor.invoke({
        atomicType,
        version,
        records,
        timeoutMs: body?.timeoutMs,
        // 契约声明的权限点在与 JWT 携带的权限点比对（执行前检查的一部分）
        grantedPermissions: req.user?.permissions ?? [],
        // 每次调用前同步一次名单：命中即拒、不回退（版本单调由服务保证）
        revocationList: this.revocations.refresh().list,
      })
      await this.audit(actor, organizationId, {
        atomicType,
        contractVersion: result.contractVersion,
        moduleSha256: result.moduleSha256,
        rows: result.rows,
        elapsedMs: result.elapsedMs,
        engine: result.engine,
        fuelUsed: result.fuelUsed,
        engineFallback: result.engineFallback,
        // 闸 3 报告进审计：档位、逐条判定（含"未判"及原因）、信号、实际回合数
        outputGate: result.outputGate,
        resourceId: undefined,
        status: 'success',
      })
      return result
    } catch (error) {
      // 失败也要留痕：审计先写，再把错误映射成 HTTP（绝不回退）
      await this.audit(actor, organizationId, {
        atomicType,
        contractVersion: version,
        elapsedMs: Date.now() - startedAt,
        status: 'failure',
        engine: this.executor.engineName(),
        reason: error instanceof Error ? error.message : String(error),
      })

      if (error instanceof AtomicRuntimeError) {
        const payload = toHttpError(error)
        throw new HttpException(payload, payload.statusCode)
      }
      throw error
    }
  }

  /** 每次调用（成功或失败）都写审计，含模块哈希与耗时。 */
  private async audit(
    actor: string,
    organizationId: string,
    detail: {
      atomicType: string
      contractVersion: string
      moduleSha256?: string
      rows?: number
      elapsedMs: number
      status: 'success' | 'failure'
      reason?: string
      resourceId?: string
      engine?: string
      fuelUsed?: number
      engineFallback?: boolean
      /** 闸 3 判定报告（成功调用才有）。 */
      outputGate?: unknown
    },
  ) {
    await this.auditLogs.create({
      action: 'atomic.invoke',
      resource: 'atomic-contract',
      resourceId: detail.resourceId,
      actor,
      status: detail.status,
      // 租户字段在记录本身上（AuditLog 继承 TenantAwareEntity），不重复塞进 metadata
      organizationId,
      metadata: {
        atomicType: detail.atomicType,
        contractVersion: detail.contractVersion,
        moduleSha256: detail.moduleSha256,
        rows: detail.rows,
        elapsedMs: detail.elapsedMs,
        ...(detail.engine ? { engine: detail.engine } : {}),
        ...(detail.fuelUsed !== undefined ? { fuelUsed: detail.fuelUsed } : {}),
        ...(detail.engineFallback ? { engineFallback: true } : {}),
        ...(detail.outputGate ? { outputGate: detail.outputGate } : {}),
        ...(detail.reason ? { reason: detail.reason } : {}),
      },
    })
  }
}
