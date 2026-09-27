import { DataSource } from 'typeorm'

/**
 * 角色 → 用户的权威分配：`users.role`（与 JWT `role` 同源）。
 * 租户范围：`organization_members`（该组织的成员）。
 *
 * 不存在 `user_roles` 关联表；`roles` 是组织内角色目录，不是分配；
 * `organization_members.role` 是 owner/member，不参与审批角色匹配。
 */
export async function usersWithRole(
  dataSource: DataSource,
  organizationId: string,
  role: string,
): Promise<string[]> {
  if (!organizationId || !role) return []
  const rows: Array<{ id: string }> = await dataSource.query(
    `SELECT u.id
       FROM users u
       INNER JOIN organization_members m ON m."userId" = u.id
      WHERE m."organizationId" = $1 AND u.role = $2`,
    [organizationId, role],
  )
  return rows.map((row) => row.id)
}

/** 组织内全部成员（单据状态变化：组织内可见）。 */
export async function organizationMemberIds(
  dataSource: DataSource,
  organizationId: string,
): Promise<string[]> {
  if (!organizationId) return []
  const rows: Array<{ userId: string }> = await dataSource.query(
    `SELECT m."userId" AS "userId"
       FROM organization_members m
      WHERE m."organizationId" = $1`,
    [organizationId],
  )
  return rows.map((row) => row.userId)
}
