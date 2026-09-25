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
        ...(detail.reason ? { reason: detail.reason } : {}),
      },
    })
  }
}
