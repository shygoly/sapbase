#!/usr/bin/env node
/**
 * 把 users.roleId 回填为主组织的 organization_member_roles（source=legacy）。
 *
 * 默认 dry-run；`--apply` 才写入。输出差异报告：扫描/已存在/新增/缺角色/无成员关系。
 * 只回填“主组织”（最早加入的 organization_members），避免跨组织误授权。
 */
import { Client } from 'pg'

const apply = process.argv.includes('--apply')
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sapbasic',
  user: process.env.DB_USERNAME || process.env.USER,
  password: process.env.DB_PASSWORD || undefined,
})

const report = {
  mode: apply ? 'apply' : 'dry-run',
  scanned: 0,
  inserted: 0,
  existing: 0,
  missingRole: 0,
  noMembership: 0,
  details: [],
}

await client.connect()
try {
  const users = await client.query(
    `SELECT id, email, "roleId", role FROM public.users WHERE "roleId" IS NOT NULL ORDER BY email`,
  )
  for (const user of users.rows) {
    report.scanned += 1
    const membership = await client.query(
      `SELECT "organizationId"
         FROM public.organization_members
        WHERE "userId" = $1
        ORDER BY "joinedAt" ASC NULLS LAST, "createdAt" ASC
        LIMIT 1`,
      [user.id],
    )
    if (membership.rows.length === 0) {
      report.noMembership += 1
      report.details.push({ email: user.email, reason: 'no-membership' })
      continue
    }
    const organizationId = membership.rows[0].organizationId
    const role = await client.query(
      `SELECT id, name, status FROM public.roles WHERE id = $1 AND "organizationId" = $2`,
      [user.roleId, organizationId],
    )
    if (role.rows.length === 0) {
      report.missingRole += 1
      report.details.push({
        email: user.email,
        organizationId,
        reason: 'role-not-in-primary-org',
      })
      continue
    }
    const binding = role.rows[0]
    if (binding.status !== 'active') {
      report.missingRole += 1
      report.details.push({
        email: user.email,
        organizationId,
        reason: 'role-inactive',
        role: binding.name,
      })
      continue
    }
    const existing = await client.query(
      `SELECT id FROM public.organization_member_roles
        WHERE "organizationId" = $1 AND "userId" = $2 AND "roleName" = $3`,
      [organizationId, user.id, binding.name],
    )
    if (existing.rows.length > 0) {
      report.existing += 1
      continue
    }
    if (apply) {
      await client.query(
        `INSERT INTO public.organization_member_roles
           (id, "createdAt", "updatedAt", "organizationId", "userId", "roleId", "roleName", source, status)
         VALUES (public.uuid_generate_v4(), now(), now(), $1, $2, $3, $4, 'legacy', 'active')
         ON CONFLICT ("organizationId", "userId", "roleName") DO NOTHING`,
        [organizationId, user.id, binding.id, binding.name],
      )
    }
    report.inserted += 1
  }
} finally {
  await client.end()
}

console.log(JSON.stringify(report, null, 2))
