import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'
import { AppReleaseTestEvidence } from './entities/app-release-test-evidence.entity'

export interface ReleaseTestEvidenceRecord {
  organizationId: string
  appKey: string
  commitSha?: string | null
  suiteSummary: Record<string, unknown>
  jestOutputDigest: string
  ranAt?: Date
  ranBy?: string | null
}

export interface ReleaseTestEvidencePort {
  findFresh(organizationId: string, appKey: string, hours?: number): Promise<AppReleaseTestEvidence | null>
}

@Injectable()
export class ReleaseTestEvidenceService implements ReleaseTestEvidencePort {
  constructor(
    @InjectRepository(AppReleaseTestEvidence)
    private readonly evidence: Repository<AppReleaseTestEvidence>,
  ) {}

  async record(input: ReleaseTestEvidenceRecord): Promise<AppReleaseTestEvidence> {
    return this.evidence.save(
      this.evidence.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        commitSha: input.commitSha ?? null,
        suiteSummary: input.suiteSummary,
        jestOutputDigest: input.jestOutputDigest,
        ranAt: input.ranAt ?? new Date(),
        ranBy: input.ranBy ?? null,
      }),
    )
  }

  async findFresh(organizationId: string, appKey: string, hours = 24): Promise<AppReleaseTestEvidence | null> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.evidence.findOne({
      where: { organizationId, appKey, ranAt: MoreThan(since) },
      order: { ranAt: 'DESC' },
    })
  }
}
