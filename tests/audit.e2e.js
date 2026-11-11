/**
 * 审计链 e2e：并发写入、查询/导出审计、脱敏、checkpoint/verify、break-glass。
 *
 * Run: node tests/audit.e2e.js
 * Requires: API 3051 + PostgreSQL。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'

function sql(statement) {
  return execFileSync('psql', ['-d', DB, '-tAc', statement], { encoding: 'utf8' }).trim()
}

async function login() {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: '123456' }),
  })
  return (await response.json()).data
}

async function main() {
  const session = await login()
  const org = session.currentOrganizationId
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  // 登录本身应写 auth.login
  const loginAudit = sql(
    `SELECT count(*) FROM audit_logs WHERE "organizationId"='${org}' AND action='auth.login' AND seq IS NOT NULL`,
  )
  assert.ok(Number(loginAudit) >= 1, 'expected auth.login audit')

  // 并发写入：seq 不重号、链不断
  const actor = `audit-e2e-${Date.now()}`
  const creates = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      call('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify({
          action: 'settings.update',
          resource: 'settings',
          actor: `${actor}-${index}`,
          status: 'success',
          metadata: { password: 'should-be-redacted', index },
        }),
      }),
    ),
  )
  for (const result of creates) assert.equal(result.status, 201, JSON.stringify(result.data))

  const seqRows = sql(
    `SELECT count(*)::int, count(DISTINCT seq)::int, min(seq), max(seq)
       FROM audit_logs WHERE "organizationId"='${org}' AND actor LIKE '${actor}%' AND seq IS NOT NULL`,
  )
  const [count, distinct, min, max] = seqRows.split('|').map(Number)
  assert.equal(count, 20)
  assert.equal(distinct, 20)
  assert.equal(max - min + 1, 20)

  // 查询 + 脱敏 + 访问审计
  const listed = await call(`/api/audit-logs?actor=${encodeURIComponent(actor)}&page=1&pageSize=50`)
  assert.equal(listed.status, 200, JSON.stringify(listed.data))
  assert.equal(listed.data.length, 20)
  assert.equal(listed.data[0].metadata.password, '[REDACTED]')
  const queryAudit = sql(
    `SELECT count(*) FROM audit_logs WHERE "organizationId"='${org}' AND action='audit.query'`,
  )
  assert.ok(Number(queryAudit) >= 1)

  // 导出 + 访问审计
  const exported = await fetch(`${API}/api/audit-logs/export?format=json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actor, pageSize: 100 }),
  })
  assert.equal(exported.status, 201)
  assert.ok((await exported.text()).includes('[REDACTED]'))
  const exportAudit = sql(
    `SELECT count(*) FROM audit_logs WHERE "organizationId"='${org}' AND action='audit.export'`,
  )
  assert.ok(Number(exportAudit) >= 1)

  // checkpoint + verify（从锚点向后）
  const checkpoint = await call('/api/audit-logs/checkpoint', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.equal(checkpoint.status, 201, JSON.stringify(checkpoint.data))
  const verified = await call('/api/audit-logs/verify')
  assert.equal(verified.status, 200, JSON.stringify(verified.data))
  assert.equal(verified.data.valid, true, JSON.stringify(verified.data))
  assert.ok(verified.data.checkpointSeq)

  // break-glass：清理必须留审计
  const cleanup = await call('/api/audit-logs/cleanup', {
    method: 'POST',
    body: JSON.stringify({ reason: 'audit-e2e' }),
  })
  assert.equal(cleanup.status, 201, JSON.stringify(cleanup.data))
  const breakGlass = sql(
    `SELECT count(*) FROM audit_logs WHERE "organizationId"='${org}' AND action='audit.break_glass'`,
  )
  assert.ok(Number(breakGlass) >= 1)

  // 负例：普通 SQL 更新/删除必须被 append-only 触发器拒绝
  let updateRejected = false
  try {
    sql(`UPDATE audit_logs SET actor='tampered' WHERE "organizationId"='${org}' AND actor LIKE '${actor}%'`)
  } catch {
    updateRejected = true
  }
  assert.equal(updateRejected, true, 'direct update must be rejected')
  let deleteRejected = false
  try {
    sql(`DELETE FROM audit_logs WHERE "organizationId"='${org}' AND actor LIKE '${actor}%'`)
  } catch {
    deleteRejected = true
  }
  assert.equal(deleteRejected, true, 'direct delete must be rejected')

  // 异步导出：xlsx / pdf 真实产物，不阻塞请求
  async function asyncExport(format) {
    const created = await call('/api/audit-exports', {
      method: 'POST',
      body: JSON.stringify({ format, filter: { actor, limit: 50 } }),
    })
    assert.equal(created.status, 201, JSON.stringify(created.data))
    const jobId = created.data.jobId
    let job = null
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      job = (await call(`/api/audit-exports/${jobId}`)).data
      if (job.status === 'succeeded') break
      if (['failed', 'dead'].includes(job.status)) {
        throw new Error(`audit export ${job.status}: ${JSON.stringify(job.error)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    assert.equal(job.status, 'succeeded', JSON.stringify(job))
    const file = await fetch(`${API}/api/audit-exports/${jobId}/download`, { headers })
    assert.equal(file.status, 200, `download ${file.status}`)
    return Buffer.from(await file.arrayBuffer())
  }

  const xlsx = await asyncExport('xlsx')
  assert.equal(xlsx.subarray(0, 2).toString(), 'PK')
  const pdf = await asyncExport('pdf')
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')

  // 告警
  const alerts = await call('/api/audit-logs/alerts?windowMinutes=60')
  assert.equal(alerts.status, 200)
  assert.ok(Array.isArray(alerts.data.alerts))

  // 跨租户：随机组织头应被拒绝
  const cross = await fetch(`${API}/api/audit-logs?page=1&pageSize=1`, {
    headers: { ...headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
  })
  assert.ok([400, 403, 404].includes(cross.status), `cross tenant ${cross.status}`)

  console.log('✓ append-only：普通 UPDATE/DELETE 被拒绝')
  console.log('✓ 并发 20 条审计：seq 不重号、不断链')
  console.log('✓ 查询/导出写访问审计；password 脱敏')
  console.log('✓ 异步导出 xlsx/pdf 产物有效')
  console.log('✓ checkpoint 锚点验证通过；break-glass 留痕；跨租户拒绝')
  console.log('audit e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
