import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export interface DashboardSummary {
  users: number
  roles: number
  appInstallations: number
  releases: number
  pendingProposals: number
  feedback7d: number
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private async count(sql: string, params: unknown[]): Promise<number> {
    const rows = (await this.dataSource.query(sql, params)) as Array<{ count: string | number }>
    return Number(rows[0]?.count ?? 0)
  }

  async summary(organizationId: string): Promise<DashboardSummary> {
    const [users, roles, appInstallations, releases, pendingProposals, feedback7d] = await Promise.all([
      this.count(`SELECT COUNT(*)::int AS count FROM organization_members WHERE "organizationId" = $1`, [organizationId]),
      this.count(`SELECT COUNT(*)::int AS count FROM roles WHERE "organizationId" = $1`, [organizationId]),
      this.count(`SELECT COUNT(*)::int AS count FROM app_installations WHERE "organizationId" = $1`, [organizationId]),
      this.count(`SELECT COUNT(*)::int AS count FROM app_releases WHERE "organizationId" = $1`, [organizationId]),
      this.count(
        `SELECT COUNT(*)::int AS count FROM app_change_proposals WHERE "organizationId" = $1 AND status IN ('draft','submitted','validating','validated','approved')`,
        [organizationId],
      ),
      this.count(
        `SELECT COUNT(*)::int AS count FROM agent_feedback WHERE "organizationId" = $1 AND "createdAt" > now() - interval '7 days'`,
        [organizationId],
      ),
    ])
    return { users, roles, appInstallations, releases, pendingProposals, feedback7d }
  }
}
