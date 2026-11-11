/**
 * AI 内容治理 e2e：溯源 → 标识 → 内容安全检测 → 人工/终审 → 发布闸 → 评分/申诉。
 *
 * Run: node tests/ai-governance.e2e.js
 * Requires: API 3051 + PostgreSQL。
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
  return (await response.json()).data
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

async function main() {
  const adminSession = await login('admin@example.com')
  const managerSession = await login('manager@example.com')
  const admin = client(adminSession)
  const manager = client(managerSession)
  const org = adminSession.currentOrganizationId
  const contentId = randomUUID()
  const subjectId = `student-${Date.now()}`

  try {
    // 溯源：prompt 只存 hash
    const provenance = await admin.call('/api/ai-governance/provenance', {
      method: 'POST',
      body: JSON.stringify({
        contentId,
        contentType: 'text',
        producer: 'piagent-builder',
        content: 'AI generated lesson plan',
        prompt: 'secret prompt should not persist',
        agent: 'piagent-builder',
        model: 'deepseek-chat',
        taskId: 'task-1',
      }),
    })
    assert.equal(provenance.status, 201, JSON.stringify(provenance.data))
    assert.match(provenance.data.promptHash, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(provenance.data).includes('secret prompt'), false)

    // 未标识 → 发布闸拒绝
    const initialGate = await admin.call(`/api/ai-governance/gate/${contentId}`)
    assert.equal(initialGate.data.allowed, false)
    assert.match(initialGate.data.reason, /label_missing/)

    await admin.call('/api/ai-governance/labels', {
      method: 'POST',
      body: JSON.stringify({ contentId, labelType: 'explicit' }),
    })
    await admin.call('/api/ai-governance/labels', {
      method: 'POST',
      body: JSON.stringify({ contentId, labelType: 'implicit' }),
    })
    const verified = await admin.call('/api/ai-governance/labels/verify', {
      method: 'POST',
      body: JSON.stringify({ contentId, labelType: 'explicit' }),
    })
    assert.equal(verified.data.valid, true)

    // 提交终审：干净内容 check pass，human/final 待审
    const submitted = await admin.call('/api/ai-governance/review/submit', {
      method: 'POST',
      body: JSON.stringify({ contentId, text: 'clean lesson content' }),
    })
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data))
    assert.equal(submitted.data.safety.status, 'pass')

    const pendingGate = await admin.call(`/api/ai-governance/gate/${contentId}`)
    assert.equal(pendingGate.data.allowed, false)
    assert.match(pendingGate.data.reason, /review-pending/)

    // 让审批角色可用（e2e 使用 Admin 角色）
    sql(
      `UPDATE blueprint_approvals SET role='Admin', selector=NULL WHERE "recordId"='${contentId}' AND "ruleId"='ai-content-final'`,
    )
    const approvals = (await admin.call(`/api/review/approvals?recordId=${contentId}&ruleId=ai-content-final`)).data
    const human = approvals.find((row) => row.stepIndex === 1)
    const final = approvals.find((row) => row.stepIndex === 2)
    assert.ok(human && final)

    const step1 = await admin.call(`/api/review/approvals/${human.id}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: 'human ok' }),
    })
    assert.equal(step1.status, 200, JSON.stringify(step1.data))

    // 作者不能自我终审
    const selfFinal = await admin.call(`/api/review/approvals/${final.id}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: 'self' }),
    })
    assert.equal(selfFinal.status, 403, JSON.stringify(selfFinal.data))

    const step2 = await manager.call(`/api/review/approvals/${final.id}/act`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', comment: 'final ok' }),
    })
    assert.equal(step2.status, 200, JSON.stringify(step2.data))
    const allowedGate = await admin.call(`/api/ai-governance/gate/${contentId}`)
    assert.equal(allowedGate.data.allowed, true, JSON.stringify(allowedGate.data))

    // 评分：AI 参考分 → 教师确认 → 申诉 → 终审
    const score = await admin.call('/api/ai-governance/scores', {
      method: 'POST',
      body: JSON.stringify({
        contentId,
        subjectType: 'student',
        subjectId,
        aiScore: 88,
        ruleVersion: 'v1',
      }),
    })
    assert.equal(score.data.status, 'ai_only')
    const confirmed = await admin.call(`/api/ai-governance/scores/${score.data.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ humanScore: 90 }),
    })
    assert.equal(confirmed.data.status, 'teacher_confirmed')
    const appealed = await admin.call(`/api/ai-governance/scores/${score.data.id}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason: '希望人工复核' }),
    })
    assert.equal(appealed.data.status, 'appealed')
    const finalized = await manager.call(`/api/ai-governance/scores/${score.data.id}/finalize`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(finalized.data.status, 'final')

    // 规则确认
    const rule = await admin.call('/api/ai-governance/scores/rule-confirm', {
      method: 'POST',
      body: JSON.stringify({ subjectType: 'student', subjectId, ruleVersion: 'v2' }),
    })
    assert.equal(rule.status, 201)
    const ruleCheck = await admin.call(
      `/api/ai-governance/scores/rule-confirm?subjectType=student&subjectId=${subjectId}&ruleVersion=v2`,
    )
    assert.equal(ruleCheck.data.confirmed, true)

    // 跨租户拒绝
    const cross = await fetch(`${API}/api/ai-governance/gate/${contentId}`, {
      headers: {
        Authorization: `Bearer ${adminSession.access_token}`,
        'X-Organization-Id': '00000000-0000-4000-8000-000000000000',
      },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross tenant ${cross.status}`)

    console.log('✓ 溯源只存 prompt hash；标识缺失阻断发布')
    console.log('✓ 机器检测 pass → 人工 → 终审；作者自我终审 403')
    console.log('✓ 评分 ai_only → teacher_confirmed → appealed → final；规则确认')
    console.log('ai governance e2e passed')
  } finally {
    sql(`DELETE FROM review_events WHERE "recordId"='${contentId}'`)
    sql(`DELETE FROM work_items WHERE "sourceId" IN (SELECT id FROM blueprint_approvals WHERE "recordId"='${contentId}')`)
    sql(`DELETE FROM blueprint_approvals WHERE "recordId"='${contentId}'`)
    sql(`DELETE FROM ai_content_provenance WHERE "contentId"='${contentId}'`)
    sql(`DELETE FROM ai_content_labels WHERE "contentId"='${contentId}'`)
    sql(`DELETE FROM ai_score_records WHERE "contentId"='${contentId}' OR "subjectId"='${subjectId}'`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
