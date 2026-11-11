/**
 * 异步消费者 e2e：data.export 真实走 worker；确认没有第二套 agent run 表。
 *
 * Run: node tests/async-consumers.e2e.js
 * Requires: API 3051 + JOBS_WORKER_ENABLED=true + PostgreSQL。
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
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': session.currentOrganizationId,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  const created = await call('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      type: 'data.export',
      payload: { format: 'json', limit: 5 },
    }),
  })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  const jobId = created.data.job.id

  let job = null
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const result = await call(`/api/jobs/${jobId}`)
    job = result.data
    if (job.status === 'succeeded') break
    if (['failed', 'dead'].includes(job.status)) {
      throw new Error(`data.export ${job.status}: ${JSON.stringify(job.error)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  assert.equal(job.status, 'succeeded', JSON.stringify(job))
  assert.equal(job.type, 'data.export')
  assert.equal(typeof job.result?.content, 'string')
  assert.ok(Number(job.result?.count) >= 0)

  // Agent 长任务只桥接既有 Agent Runtime；不得新增第二套 run 状态表。
  const agentRunTables = sql(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'agent_run%'`,
  )
  assert.equal(agentRunTables, '', `unexpected agent run tables: ${agentRunTables}`)

  console.log('✓ data.export job 经 worker 成功，返回行数与内容')
  console.log('✓ 无第二套 agent run 状态表（真源仍是 Agent Runtime）')
  console.log('async consumers e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
