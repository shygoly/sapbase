/**
 * 实例演进 e2e：回流脱敏 + 升级冲突检测 + 提议回流包。
 *
 * Run: node tests/evolution.e2e.js
 * Requires: API 3051.
 */

const assert = require('node:assert')

const API = process.env.API_BASE || 'http://localhost:3051'

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: '123456' }),
  }).then((r) => r.json())
  const session = login.data
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': session.currentOrganizationId,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  const redacted = await call('/api/builder/backflow/check', {
    method: 'POST',
    body: JSON.stringify({
      text: '客户：山禾制造；联系人：张三；金额 CNY 12,000；单号 SO-20261111001；电话 13800138000',
    }),
  })
  assert.equal(redacted.status, 201, JSON.stringify(redacted.data))
  assert.equal(redacted.data.safe, false)
  assert.ok(redacted.data.findings.length >= 5)
  assert.ok(redacted.data.text.includes('[CUSTOMER]'))
  assert.ok(redacted.data.text.includes('[ORDER_NO]'))

  const conflict = await call('/api/builder/upgrade/conflicts', {
    method: 'POST',
    body: JSON.stringify({
      base: { form: { title: 'A' } },
      instance: { form: { title: 'Instance' } },
      next: { form: { title: 'Platform' } },
    }),
  })
  assert.equal(conflict.status, 201)
  assert.equal(conflict.data.compatible, false)
  assert.equal(conflict.data.conflicts[0].path, 'form.title')

  const clean = await call('/api/builder/upgrade/conflicts', {
    method: 'POST',
    body: JSON.stringify({
      base: { form: { title: 'A', amount: 1 } },
      instance: { form: { title: 'Instance', amount: 1 } },
      next: { form: { title: 'A', amount: 2 } },
    }),
  })
  assert.equal(clean.data.compatible, true)
  assert.deepEqual(clean.data.resolved, { form: { title: 'Instance', amount: 2 } })

  const appKey = `e2e-evolution-${Date.now()}`
  const draft = await call(`/api/builder/apps/${appKey}/drafts`, {
    method: 'POST',
    body: JSON.stringify({
      content: { platformVersion: '1.0.0', evolutionScope: ['field'] },
    }),
  })
  assert.equal(draft.status, 201, JSON.stringify(draft.data))

  const proposal = await call('/api/builder/proposals', {
    method: 'POST',
    body: JSON.stringify({
      appKey,
      draftId: draft.data.id,
      type: 'form',
      areas: ['field'],
      title: 'E2E 回流提议',
      summary: '客户：山禾制造；金额 CNY 12,000',
      diff: { field: { label: '客户名称', contact: '张三 13800138000' } },
      evidence: [{ type: 'feedback', id: 'f1' }],
      risk: {
        breaking: false,
        permissionChange: false,
        migration: false,
        agentBehaviorChange: false,
      },
      testPlan: { unit: ['evolution-backflow.spec.ts'] },
      rollbackPlan: { strategy: 'deactivate-release' },
      platformVersion: '1.0.0',
      evolutionScope: ['field'],
    }),
  })
  assert.equal(proposal.status, 201, JSON.stringify(proposal.data))

  const backflow = await call(`/api/builder/proposals/${proposal.data.id}/backflow`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(backflow.status, 201, JSON.stringify(backflow.data))
  assert.equal(backflow.data.requiresManualApproval, true)
  assert.equal(backflow.data.next, 'platform-review')
  assert.equal(backflow.data.safe, false)
  assert.ok(backflow.data.redacted.summary.includes('[CUSTOMER]'))
  assert.ok(backflow.data.redacted.diff.field.contact.includes('[PHONE]'))


  // 3.4 负例：缺绑定、越界 diff、自批
  const draft2 = await call(`/api/builder/apps/${appKey}-2/drafts`, {
    method: 'POST',
    body: JSON.stringify({ content: {} }),
  })
  assert.equal(draft2.status, 201)
  const noBinding = await call('/api/builder/proposals', {
    method: 'POST',
    body: JSON.stringify({
      appKey: `${appKey}-2`,
      draftId: draft2.data.id,
      type: 'form',
      areas: ['field'],
      title: '缺绑定提议',
      summary: 'missing binding',
      diff: { field: { label: 'x' } },
      evidence: [{ type: 'feedback', id: 'f2' }],
      risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false },
      testPlan: { unit: ['x'] },
      rollbackPlan: { strategy: 'deactivate-release' },
    }),
  })
  assert.equal(noBinding.status, 201, JSON.stringify(noBinding.data))
  const selfApprove = await call(`/api/builder/proposals/${noBinding.data.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ role: 'owner', comment: 'self' }),
  })
  assert.ok([403, 409].includes(selfApprove.status), `self approve ${selfApprove.status}`)

  const outOfScope = await call('/api/builder/proposals', {
    method: 'POST',
    body: JSON.stringify({
      appKey,
      draftId: draft.data.id,
      type: 'form',
      areas: ['field'],
      title: '越界提议',
      summary: 'drop table',
      diff: { tables: { users: 'drop' } },
      evidence: [{ type: 'feedback', id: 'f3' }],
      risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false },
      testPlan: { unit: ['x'] },
      rollbackPlan: { strategy: 'deactivate-release' },
      platformVersion: '1.0.0',
      evolutionScope: ['field'],
    }),
  })
  assert.equal(outOfScope.status, 400, JSON.stringify(outOfScope.data))

  console.log('✓ 负例：自批/越界 diff 被拒绝')

  console.log('✓ 回流脱敏：客户/金额/单号/人员/手机')
  console.log('✓ 升级冲突：双方改同一路径阻塞；单侧改动自动合并')
  console.log('✓ 提议回流包：脱敏 + platform-review + 人工审批')
  console.log('evolution e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
