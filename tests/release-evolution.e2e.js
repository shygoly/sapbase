/**
 * 实例演进完整链路 e2e：起草 → 校验 → 预览 → 人批 → 灰度 → 观察 → 回退。
 * 需要 admin 起草、manager 审批/发布（作者≠批准人）。
 */

const assert = require('node:assert')

const API = process.env.API_BASE || 'http://localhost:3051'
const APP_KEY = `e2e-release-${Date.now()}`
const INSTALLATION_ID = `11111111-2222-4333-8444-${String(Date.now()).slice(-12)}`

async function login(email) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: '123456' }),
  })
  assert.equal(response.status, 201)
  const body = await response.json()
  return body.data
}

function client(session) {
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
  return { call, headers }
}

async function main() {
  const admin = await login('admin@example.com')
  const manager = await login('manager@example.com')
  const a = client(admin)
  const m = client(manager)

  // 起草
  const draft = await a.call(`/api/builder/apps/${APP_KEY}/drafts`, {
    method: 'POST',
    body: JSON.stringify({
      content: { platformVersion: '1.0.0', evolutionScope: ['field'] },
    }),
  })
  assert.equal(draft.status, 201, JSON.stringify(draft.data))

  // 测试证据（让 G4 使用真实记录，不重新跑整套 jest）
  const evidence = await a.call('/api/builder/test-evidence', {
    method: 'POST',
    body: JSON.stringify({
      appKey: APP_KEY,
      suiteSummary: { suite: 'release-evolution-e2e', passed: 1, failed: 0 },
      jestOutputDigest: `sha256:${'a'.repeat(64)}`,
    }),
  })
  assert.equal(evidence.status, 201, JSON.stringify(evidence.data))

  // 提议
  const proposal = await a.call('/api/builder/proposals', {
    method: 'POST',
    body: JSON.stringify({
      appKey: APP_KEY,
      draftId: draft.data.id,
      type: 'form',
      areas: ['field'],
      title: 'E2E 实例演进',
      summary: '字段标签调整',
      diff: { field: { label: '客户名称' } },
      evidence: [{ type: 'feedback', id: 'f1' }],
      risk: {
        breaking: false,
        permissionChange: false,
        migration: false,
        agentBehaviorChange: false,
      },
      testPlan: { unit: ['release-evolution-e2e'] },
      rollbackPlan: { strategy: 'deactivate-release' },
      platformVersion: '1.0.0',
      evolutionScope: ['field'],
    }),
  })
  assert.equal(proposal.status, 201, JSON.stringify(proposal.data))

  // 校验 + 预览
  const validate = await a.call(`/api/builder/proposals/${proposal.data.id}/validate`, {
    method: 'POST',
    body: JSON.stringify({ previewUrl: 'http://localhost:3050/dashboard/overview' }),
  })
  assert.equal(validate.status, 201, JSON.stringify(validate.data))
  assert.equal(validate.data.status, 'validated', JSON.stringify(validate.data))
  assert.equal(validate.data.risk.gates.G6.status, 'passed')

  // 人批（作者 admin，批准人 manager）
  const approve = await m.call(`/api/builder/proposals/${proposal.data.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ role: 'owner', comment: 'approve e2e' }),
  })
  assert.equal(approve.status, 201, JSON.stringify(approve.data))
  assert.equal(approve.data.status, 'approved')

  const publish = async (version, channel) => {
    const result = await m.call('/api/builder/releases', {
      method: 'POST',
      headers: { ...m.headers, 'Idempotency-Key': `${APP_KEY}-${version}` },
      body: JSON.stringify({
        appKey: APP_KEY,
        version,
        channel,
        manifest: { appKey: APP_KEY, version, layers: { public: [] } },
        changelog: { 'zh-CN': [{ type: 'changed', title: `e2e ${version}` }] },
      }),
    })
    assert.equal(result.status, 201, JSON.stringify(result.data))
    return result.data.result
  }

  // 发布 v1 + 激活
  const v1 = await publish('1.0.0', 'canary')
  const activate1 = await m.call(`/api/builder/releases/${v1.id}/activate`, {
    method: 'POST',
    headers: { ...m.headers, 'Idempotency-Key': `${APP_KEY}-act-v1` },
    body: JSON.stringify({ appInstallationId: INSTALLATION_ID, reason: 'e2e activate' }),
  })
  assert.equal(activate1.status, 201, JSON.stringify(activate1.data))
  assert.equal(activate1.data.result.status, 'active')

  // 灰度 v2（cohort 模式，不触发单 active 唯一约束）
  const v2 = await publish('1.1.0', 'canary')
  const activate2 = await m.call(`/api/builder/releases/${v2.id}/activate`, {
    method: 'POST',
    headers: { ...m.headers, 'Idempotency-Key': `${APP_KEY}-act-v2` },
    body: JSON.stringify({
      appInstallationId: INSTALLATION_ID,
      cohort: { percent: 10 },
      reason: 'e2e canary',
    }),
  })
  assert.equal(activate2.status, 201, JSON.stringify(activate2.data))
  assert.equal(activate2.data.result.status, 'active')

  // 观察：impact + 当前 release
  const impact = await m.call(`/api/builder/releases/${v2.id}/impact`)
  assert.equal(impact.status, 200, JSON.stringify(impact.data))
  assert.ok(Array.isArray(impact.data.items ?? impact.data.diff))
  const current = await m.call(`/api/builder/releases/${v2.id}`)
  assert.equal(current.status, 200)
  assert.equal(current.data.version, '1.1.0')

  // 回退到 v1
  const rollback = await m.call(`/api/builder/releases/${v1.id}/rollback`, {
    method: 'POST',
    headers: { ...m.headers, 'Idempotency-Key': `${APP_KEY}-rollback` },
    body: JSON.stringify({ appInstallationId: INSTALLATION_ID, reason: 'e2e rollback' }),
  })
  assert.equal(rollback.status, 201, JSON.stringify(rollback.data))
  assert.equal(rollback.data.result.action, 'rollback')
  assert.equal(rollback.data.result.releaseId, v1.id)

  console.log('✓ 起草 → 校验（G6 预览）→ 人批')
  console.log('✓ 发布 v1/v2 → 激活 → 灰度 cohort → 观察 impact')
  console.log('✓ 回退到 v1')
  console.log('release evolution e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
