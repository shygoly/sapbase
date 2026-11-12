#!/usr/bin/env node
/**
 * SaaS 多租户数据完整性检查（只读）。
 *
 * 检查：组织/成员引用、租户表 organizationId 空值/孤儿、角色绑定引用、
 * 重复 slug/key。发现 error 时退出码 1；warning 不阻断。
 */
import { Client } from 'pg'

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sapbasic',
  user: process.env.DB_USERNAME || process.env.USER,
  password: process.env.DB_PASSWORD || undefined,
})

const report = { errors: [], warnings: [], checks: [] }

function error(message, detail) {
  report.errors.push({ message, detail })
}

function warning(message, detail) {
  report.warnings.push({ message, detail })
}

async function scalar(sql, params = []) {
  const result = await client.query(sql, params)
  return Number(result.rows[0]?.count ?? 0)
}

await client.connect()
try {
  const organizations = await scalar(`SELECT count(*)::int AS count FROM public.organizations`)
  const users = await scalar(`SELECT count(*)::int AS count FROM public.users`)
  report.checks.push({ name: 'organizations', value: organizations })
  report.checks.push({ name: 'users', value: users })

  const orphanMembers = await scalar(
    `SELECT count(*)::int AS count
       FROM public.organization_members m
       LEFT JOIN public.organizations o ON o.id::text = m."organizationId"::text
       LEFT JOIN public.users u ON u.id::text = m."userId"::text
      WHERE o.id IS NULL OR u.id IS NULL`,
  )
  if (orphanMembers > 0) error('organization_members 存在孤儿引用', orphanMembers)

  const usersWithoutOrg = await scalar(
    `SELECT count(*)::int AS count
       FROM public.users u
      WHERE NOT EXISTS (
        SELECT 1 FROM public.organization_members m WHERE m."userId" = u.id
      )`,
  )
  if (usersWithoutOrg > 0) warning('用户没有组织成员关系（可能是历史/系统账号）', usersWithoutOrg)

  const duplicateSlugs = await client.query(
    `SELECT slug, count(*)::int AS count
       FROM public.organizations GROUP BY slug HAVING count(*) > 1`,
  )
  if (duplicateSlugs.rows.length > 0) error('organizations.slug 重复', duplicateSlugs.rows)

  const tenantTables = await client.query(
    `SELECT table_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'organizationId'
        AND table_name NOT IN ('organizations')
      ORDER BY table_name`,
  )
  for (const row of tenantTables.rows) {
    const table = row.table_name
    const nulls = await scalar(
      `SELECT count(*)::int AS count FROM public."${table}" WHERE "organizationId" IS NULL`,
    )
    if (nulls > 0) warning(`租户表 ${table} 存在 organizationId NULL`, nulls)
    const orphans = await scalar(
      `SELECT count(*)::int AS count
         FROM public."${table}" t
         LEFT JOIN public.organizations o ON o.id::text = t."organizationId"::text
        WHERE t."organizationId" IS NOT NULL AND o.id IS NULL`,
    )
    if (orphans > 0) error(`租户表 ${table} 存在孤儿 organizationId`, orphans)
  }

  const orphanRoleBindings = await scalar(
    `SELECT count(*)::int AS count
       FROM public.organization_member_roles r
       LEFT JOIN public.organizations o ON o.id::text = r."organizationId"::text
       LEFT JOIN public.users u ON u.id::text = r."userId"::text
      WHERE o.id IS NULL OR u.id IS NULL`,
  )
  if (orphanRoleBindings > 0) error('organization_member_roles 存在孤儿引用', orphanRoleBindings)

  const orphanRoles = await scalar(
    `SELECT count(*)::int AS count
       FROM public.roles r
       LEFT JOIN public.organizations o ON o.id::text = r."organizationId"::text
      WHERE o.id IS NULL`,
  )
  if (orphanRoles > 0) error('roles 存在孤儿 organizationId', orphanRoles)

  const duplicateProviderKeys = await client.query(
    `SELECT "organizationId", key, count(*)::int AS count
       FROM public.identity_providers
      GROUP BY "organizationId", "key" HAVING count(*) > 1`,
  )
  if (duplicateProviderKeys.rows.length > 0) {
    error('identity_providers (organizationId,key) 重复', duplicateProviderKeys.rows)
  }
} finally {
  await client.end()
}

console.log(JSON.stringify(report, null, 2))
if (report.errors.length > 0) process.exit(1)
