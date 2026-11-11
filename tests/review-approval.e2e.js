/**
 * 复核/审批 e2e：待办双读、已读红点、委托代决定、越权/重复负例、跨租户。
 *
 * Run: node tests/review-approval.e2e.js
 * Requires: API 3051 + 本地 PostgreSQL（sapbasic）。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'

function sql(statement) {
  return execFileSync('psql', ['-d', DB, '-tAc', statement], { encoding: 'utf8' }).trim()
}

async function login(email) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: '123456' }),
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
    headers,
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

async function main() {
  const admin = await login('admin@example.com')
  const manager = await login('manager@example.com')
  const a = client(admin)
  const m = client(manager)
  const org = admin.currentOrganizationId
  const adminId = admin.user.id
  const managerId = manager.user.id

  const workItemId = randomUUID()
  const approvalId = randomUUID()
  const recordId = randomUUID()
  try {
    sql(
      `INSERT INTO work_items (id,"organizationId","sourceType","sourceId",title,status,"assigneeId",priority,"createdAt","updatedAt") VALUES ('${workItemId}','${org}','approval','${approvalId}','E2E 待办',${"'open'"},'${adminId}','high',now(),now())`,
    )
    sql(
      `INSERT INTO blueprint_approvals (id,"organizationId","blueprintId","blueprintVersion",entity,"recordId","ruleId",round,"stepIndex",role,kind,status,"createdAt","updatedAt") VALUES ('${approvalId}','${org}','e2e-bp','1.0.0','Order','${recordId}','e2e-rule',1,0,'teacher','human','pending',now(),now())`,
    )

    // 跨租户负例
    const crossTenant = await fetch(`${API}/api/review/work-items`, {
      headers: { ...a.headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(crossTenant.status), `cross tenant ${crossTenant.status}`)

    // 待办双读 + 未读红点
    const workItems = await a.call('/api/review/work-items?assignee=me')
    assert.equal(workItems.status, 200)
    const item = workItems.data.find((row) => row.id === workItemId)
    assert.ok(item, 'expected work item')
    const unread = await a.call('/api/review/work-items/unread-count?assignee=me')
    assert.ok(unread.data.count >= 1)
    const read = await a.call(`/api/review/work-items/${workItemId}/read`, { method: 'POST' })
    assert.equal(read.status, 200)
    const afterRead = await a.call('/api/review/work-items/unread-count?assignee=me')
    assert.ok(afterRead.data.count < unread.data.count)

    // 越权：admin 不是 teacher，直接 act 403
    const forbidden = await a.call(`/api/review/approvals/${approvalId}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.data))

    // 委托给 manager 后代决定
    const delegation = await a.call(`/api/review/approvals/${approvalId}/delegate`, {
      method: 'POST',
      body: JSON.stringify({ toUserId: managerId, reason: 'e2e 委托' }),
    })
    assert.equal(delegation.status, 200, JSON.stringify(delegation.data))
    const approved = await m.call(`/api/review/approvals/${approvalId}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: 'e2e 代批准' }),
    })
    assert.equal(approved.status, 200, JSON.stringify(approved.data))
    assert.equal(approved.data.status, 'approved')

    // 事件含 delegatedFrom
    const events = await m.call(`/api/review/approvals/${approvalId}/events`)
    assert.ok(
      events.data.some((event) => event.payload?.delegatedFrom === adminId),
      'expected delegatedFrom audit',
    )

    // 重复动作负例：已 approved 不能再操作
    const repeat = await m.call(`/api/review/approvals/${approvalId}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject' }),
    })
    assert.ok([409, 403].includes(repeat.status), `repeat act ${repeat.status}`)

    console.log('✓ 待办双读 + 已读红点 + 跨租户拒绝')
    console.log('✓ 越权 403；委托代决定 + delegatedFrom 审计；重复动作拒绝')
    console.log('review approval e2e passed')
  } finally {
    sql(`DELETE FROM review_events WHERE "approvalId"='${approvalId}'`)
    sql(`DELETE FROM review_delegations WHERE "approvalId"='${approvalId}'`)
    sql(`DELETE FROM work_items WHERE id='${workItemId}'`)
    sql(`DELETE FROM blueprint_approvals WHERE id='${approvalId}'`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
