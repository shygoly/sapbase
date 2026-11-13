import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { BlueprintRelease } from './blueprint-release.entity'

export interface RegisterBlueprintReleaseInput {
  organizationId: string
  blueprintId: string
  version: string
  packageId: string
  releaseDigest: string
  runtimeRequirement: string
  trustStatus?: 'verified' | 'unsigned-dev' | 'legacy'
  layers?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
  createdById?: string
  actor?: string
}

const DIGEST = /^sha256:[0-9a-f]{64}$/

@Injectable()
export class BlueprintReleasesService {
  constructor(
    @InjectRepository(BlueprintRelease)
    private readonly releases: Repository<BlueprintRelease>,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async register(input: RegisterBlueprintReleaseInput): Promise<BlueprintRelease> {
    if (!input.organizationId) throw new BadRequestException('缺少组织上下文')
    if (!input.blueprintId || !input.version) {
      throw new BadRequestException('blueprintId/version 必填')
    }
    if (!input.packageId) throw new BadRequestException('packageId 必填')
    if (!DIGEST.test(input.releaseDigest)) {
      throw new BadRequestException('releaseDigest 必须是 sha256:<64 hex>')
    }
    const existing = await this.releases.findOne({
      where: {
        organizationId: input.organizationId,
        blueprintId: input.blueprintId,
        version: input.version,
      },
    })
    if (existing) {
      if (existing.releaseDigest !== input.releaseDigest) {
        throw new ConflictException(
          `Blueprint ${input.blueprintId}@${input.version} 已登记为 ${existing.releaseDigest}，不可替换`,
        )
      }
      return existing
    }
    const release = await this.releases.save(
      this.releases.create({
        organizationId: input.organizationId,
        blueprintId: input.blueprintId,
        version: input.version,
        packageId: input.packageId,
        releaseDigest: input.releaseDigest,
        runtimeRequirement: input.runtimeRequirement,
        trustStatus: input.trustStatus ?? 'verified',
        layers: input.layers ?? {},
        metadata: input.metadata ?? null,
        createdById: input.createdById ?? null,
      }),
    )
    await this.auditLogs?.create({
      organizationId: input.organizationId,
      action: 'blueprint_release.registered',
      resource: 'blueprint_release',
      resourceId: release.id,
      actor: input.actor ?? 'system:blueprint-release',
      status: 'success',
      metadata: {
        blueprintId: release.blueprintId,
        version: release.version,
        packageId: release.packageId,
        releaseDigest: release.releaseDigest,
        trustStatus: release.trustStatus,
      },
      source: 'blueprint-releases',
    })
    return release
  }

  async findById(organizationId: string, id: string): Promise<BlueprintRelease> {
    const release = await this.releases.findOne({ where: { id, organizationId } })
    if (!release) throw new NotFoundException('Blueprint release 不存在')
    return release
  }

  async list(organizationId: string, blueprintId?: string): Promise<BlueprintRelease[]> {
    return this.releases.find({
      where: blueprintId ? { organizationId, blueprintId } : { organizationId },
      order: { createdAt: 'DESC' },
    })
  }
}
