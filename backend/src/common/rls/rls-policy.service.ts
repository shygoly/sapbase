import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common'
import { DataSource } from 'typeorm'

interface DatabaseRoleSafety {
  currentRole: string
  bypassesRls: boolean
  ownsProtectedTable: boolean
  protectedPolicyCount: number
}

@Injectable()
export class RlsPolicyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RlsPolicyService.name)

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const mode = (process.env.RLS_ENFORCEMENT ?? 'off').toLowerCase()
    if (mode === 'off') return

    const safety = await this.inspectRole()
    if (safety.protectedPolicyCount === 0) {
      const message = '未检测到 Tenant RLS 策略；生产迁移未完成'
      if (mode === 'required') throw new Error(message)
      this.logger.warn(message)
      return
    }
    if (!safety.bypassesRls && !safety.ownsProtectedTable) return

    const message =
      `RLS 不会拦截当前数据库角色 ${safety.currentRole}：` +
      `superuser/bypassrls=${safety.bypassesRls}, ownsProtectedTable=${safety.ownsProtectedTable}`
    if (mode === 'required') throw new Error(message)
    this.logger.warn(message)
  }

  private async inspectRole(): Promise<DatabaseRoleSafety> {
    const rows: DatabaseRoleSafety[] = await this.dataSource.query(`
      SELECT
        current_user AS "currentRole",
        r.rolsuper OR r.rolbypassrls AS "bypassesRls",
        EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_roles owner_role ON owner_role.oid = c.relowner
          WHERE c.relname = 'blueprint_records'
            AND c.relkind = 'r'
            AND owner_role.rolname = current_user
        ) AS "ownsProtectedTable",
        (
          SELECT count(*)::int
          FROM pg_policies
          WHERE schemaname = 'public'
            AND policyname IN ('tenant_isolation', 'tenant_parent_isolation')
        ) AS "protectedPolicyCount"
      FROM pg_roles r
      WHERE r.rolname = current_user
    `)
    if (!rows[0]) throw new Error('无法读取当前数据库角色')
    return rows[0]
  }
}
