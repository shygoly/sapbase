/**
 * 复核闭环 e2e：机器检测 → 人工驳回 → 重提 → 再检测 → 通过；warn 人工确认。
 * 需要 API 3051 + JOBS_WORKER_ENABLED=true + 本地 PostgreSQL。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')

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
  const body = await response.json()
  return body.data
}

function client(session) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': session.currentOrganizationId,
  }
  return {
    call: async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers ?? {}) },
      })
      const body = await response.json().catch(() => null)
      return { status: response.status, data: body?.data ?? body }
    },
  }
}

function insertStep(input) {
  sql(
    `INSERT INTO blueprint_approvals (id,"organizationId","blueprintId","blueprintVersion",entity,"recordId","ruleId",round,"stepIndex",role,kind,"checkProvider",status,"createdAt","updatedAt") VALUES ('${input.id}','${input.org}','e2e-bp','1.0.0','Order','${input.recordId}','${input.ruleId}',${input.round},${input.stepIndex},'${input.role}','${input.kind}',${
      input.checkProvider ? `'${input.checkProvider}'` : 'NULL'
    },'pending',now(),now())`,
  )
}

async function waitJob(call, jobId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await call(`/api/jobs/${jobId}`)
    const status = result.data?.status
    if (status === 'succeeded') return result.data
    if (['failed', 'dead', 'cancelled'].includes(status)) {
      throw new Error(`job ${jobId} ${status}: ${JSON.stringify(result.data)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`job ${jobId} timeout`)
}

async function runCheck(api, org, approvalId, round, text) {
  const created = await api.call('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      type: 'review.check',
      payload: {
        provider: 'basic',
        input: { text },
        approvalId,
        round,
        stepIndex: 0,
      },
    }),
  })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  return waitJob(api.call, created.data.job.id)
}

async function main() {
  const session = await login()
  const api = client(session)
  const org = session.currentOrganizationId
  const suffix = Date.now()
  const ruleId = `e2e-review-${suffix}`
  const recordId = randomUUID()
  const check1 = randomUUID()
  const human1 = randomUUID()

  try {
    insertStep({ id: check1, org, recordId, ruleId, round: 1, stepIndex: 0, role: 'check', kind: 'check', checkProvider: 'basic' })
    insertStep({ id: human1, org, recordId, ruleId, round: 1, stepIndex: 1, role: 'Admin', kind: 'human' })

    // 1) 机器检测通过
    await runCheck(api, org, check1, 1, 'content is clean')
    const checked = await api.call(`/api/review/approvals/${check1}`)
    assert.equal(checked.data.step.status, 'approved', JSON.stringify(checked.data.step))
    assert.equal(checked.data.step.checkResult.status, 'pass')

    // 2) 人工驳回
    const rejected = await api.call(`/api/review/approvals/${human1}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', comment: '金额说明缺失' }),
    })
    assert.equal(rejected.status, 200, JSON.stringify(rejected.data))
    assert.equal(rejected.data.status, 'rejected')

    // 3) 重提创建 round 2（旧 round 保留）
    const resubmitted = await api.call(`/api/review/approvals/${human1}/resubmit`, {
      method: 'POST',
      body: JSON.stringify({ comment: '已补充金额说明' }),
    })
    assert.equal(resubmitted.status, 201, JSON.stringify(resubmitted.data))
    assert.equal(resubmitted.data.length, 2)
    assert.ok(resubmitted.data.every((row) => row.round === 2 && row.status === 'pending'))

    const chain = await api.call(`/api/review/approvals/${human1}`)
    assert.ok(chain.data.chain.some((row) => row.round === 1 && row.status === 'rejected'))
    assert.ok(chain.data.chain.some((row) => row.round === 2 && row.status === 'pending'))

    const round2Check = resubmitted.data.find((row) => row.kind === 'check')
    const round2Human = resubmitted.data.find((row) => row.kind === 'human')
    await runCheck(api, org, round2Check.id, 2, 'content is clean')
    const approved = await api.call(`/api/review/approvals/${round2Human.id}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: '通过' }),
    })
    assert.equal(approved.status, 200, JSON.stringify(approved.data))
    assert.equal(approved.data.status, 'approved')

    // 4) warn 必须人工确认，不能当 pass
    const warnRule = `${ruleId}-warn`
    const warnId = randomUUID()
    insertStep({ id: warnId, org, recordId: randomUUID(), ruleId: warnRule, round: 1, stepIndex: 0, role: 'check', kind: 'check', checkProvider: 'basic' })
    await runCheck(api, org, warnId, 1, '联系 13800138000')
    const warned = await api.call(`/api/review/approvals/${warnId}`)
    assert.equal(warned.data.step.status, 'pending')
    assert.equal(warned.data.step.checkResult.status, 'warn')

    const bypass = await api.call(`/api/review/approvals/${warnId}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })
    assert.equal(bypass.status, 409, JSON.stringify(bypass.data))
    const confirmed = await api.call(`/api/review/approvals/${warnId}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: '已人工核对手机号归属后放行' }),
    })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data))
    assert.equal(confirmed.data.status, 'approved')

    console.log('✓ 机器检测 pass → 人工驳回 → round 2 重提 → 再检测 → 通过')
    console.log('✓ 旧轮次保留；warn 未确认 409，人工确认后通过')
    console.log('review workflow e2e passed')
  } finally {
    sql(`DELETE FROM review_events WHERE "recordId"='${recordId}' OR "recordId" IN (SELECT "recordId" FROM blueprint_approvals WHERE "ruleId" LIKE '${ruleId}%')`)
    sql(`DELETE FROM work_items WHERE "sourceId" IN (SELECT id FROM blueprint_approvals WHERE "ruleId" LIKE '${ruleId}%')`)
    sql(`DELETE FROM review_delegations WHERE "approvalId" IN (SELECT id FROM blueprint_approvals WHERE "ruleId" LIKE '${ruleId}%')`)
    sql(`DELETE FROM blueprint_approvals WHERE "ruleId" LIKE '${ruleId}%'`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
