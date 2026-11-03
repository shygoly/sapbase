import jwt from 'jsonwebtoken'
import { Client } from 'pg'

const base = 'http://localhost:3001/api'
const org = '11111111-1111-4111-8111-111111111111'
const user = '22222222-2222-4222-8222-222222222222'
const installation = '33333333-3333-4333-8333-333333333333'
const suffix = Date.now() % 100000
const version = `1.${suffix}.0`
const a2Version = `1.${suffix}.1`
const token = jwt.sign(
  {
    sub: user,
    email: 'e2e@example.com',
    role: 'Admin',
    permissions: [
      'system:manage',
      'app:release:read',
      'app:release:propose',
      'app:release:validate',
      'app:release:approve',
      'app:release:publish',
      'app:release:activate',
      'app:release:rollback',
      'tool:blueprint:read',
      'tool:blueprint:compile',
      'tool:module:read',
      'tool:atomic:invoke',
      'tool:builder:read',
      'tool:builder:write',
      'tool:builder:validate',
    ],
    organizationId: org,
  },
  'e2e-secret',
  { expiresIn: '1h' },
)
const approver = '55555555-5555-4555-8555-555555555555'
const approverToken = jwt.sign(
  { sub: approver, email: 'approver@example.com', role: 'Admin', permissions: ['app:release:approve', 'app:release:publish'], organizationId: org },
  'e2e-secret',
  { expiresIn: '1h' },
)
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const approverHeaders = { Authorization: `Bearer ${approverToken}`, 'Content-Type': 'application/json' }

async function call(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 500)}`)
  if (data && typeof data === 'object' && 'data' in data && ('code' in data || 'msg' in data)) return data.data
  return data
}

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}

async function cleanup() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:55432/sapbase_rebuild_e2e' })
  await client.connect()
  await client.query(`TRUNCATE TABLE app_release_activations, app_user_release_views, app_release_events, app_release_items, app_release_approvals, app_releases, app_change_proposals, app_drafts, agent_feedback, agent_feedback_topics, agent_knowledge_entries, agent_skill_versions, agent_eval_runs, agent_eval_cases, release_automation_runs, release_automation_policies, agent_conversations, agent_turns, agent_tool_calls RESTART IDENTITY CASCADE`)
  await client.end()
}

async function main() {
  await cleanup()
  const draft = await call('POST', '/builder/apps/erp-purchase/drafts', { content: { hello: 'e2e' } })
  assert(draft?.id, 'create draft')

  const proposal = await call('POST', '/builder/proposals', {
    appKey: 'erp-purchase',
    draftId: draft.id,
    type: 'form',
    areas: ['form'],
    title: 'E2E proposal',
    summary: 'E2E proposal summary',
    diff: { forms: [{ op: 'add', path: '/forms/e2e', value: {} }] },
    evidence: [{ type: 'feedback', ids: ['fb-e2e'] }],
    risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false },
    testPlan: { unit: ['e2e.spec.ts'] },
    rollbackPlan: { strategy: 'deactivate-release', dataSafe: true },
  })
  assert(proposal?.id, 'create proposal')

  const validated = await call('POST', `/builder/proposals/${proposal.id}/validate`, {})
  assert(validated?.status === 'validated', 'validate proposal through G0-G6')

  const approved = await call('POST', `/builder/proposals/${proposal.id}/approve`, { role: 'owner', comment: 'ok' }, approverHeaders)
  assert(approved?.status === 'approved', 'approve proposal')

  const published = await call(
    'POST',
    '/builder/releases',
    {
      appKey: 'erp-purchase',
      version,
      channel: 'stable',
      manifest: { entities: { E2E: { fields: { id: {} } } } },
      changelog: { 'zh-CN': [{ type: 'added', title: 'E2E release' }] },
    },
    { 'Idempotency-Key': `e2e-publish-${suffix}` },
  )
  assert(published?.result?.id, 'publish immutable release')
  const releaseId = published.result.id

  const activated = await call(
    'POST',
    `/builder/releases/${releaseId}/activate`,
    { appInstallationId: installation, reason: 'e2e' },
    { 'Idempotency-Key': `e2e-activate-${suffix}` },
  )
  assert(activated?.result?.status === 'active', 'activate release')

  const whatsNew = await call('GET', `/apps/erp-purchase/whats-new?appInstallationId=${installation}`)
  console.log('whatsNew=', JSON.stringify(whatsNew));
  assert(whatsNew?.release?.version === version, 'whats-new returns active changelog')

  const read = await call('POST', `/apps/erp-purchase/whats-new/${releaseId}/read`, { appInstallationId: installation })
  assert(Boolean(read?.lastSeenReleaseId), 'mark whats-new read')

  await call('POST', '/agent/feedback', {
    appKey: 'erp-purchase',
    releaseId,
    category: 'bug',
    content: 'e2e feedback 13800138000',
  })
  const topics = await call('GET', '/agent/feedback/triage?appKey=erp-purchase')
  assert(Array.isArray(topics), 'feedback triage')

  const knowledgeDraft = await call('POST', '/agent-knowledge/drafts', {
    scope: 'organization',
    knowledgeKey: 'e2e-tax',
    title: 'E2E tax',
    body: 'Rate range 0-100. Contact 13800138000',
  })
  assert(knowledgeDraft?.id, 'create knowledge draft')
  const knowledgePublished = await call('POST', `/agent-knowledge/${knowledgeDraft.id}/publish`, {
    confirmedSensitive: true,
  })
  assert(knowledgePublished?.status === 'published', 'publish knowledge with sensitive confirmation')

  const knowledgeV2 = await call('POST', '/agent-knowledge/drafts', {
    scope: 'organization',
    knowledgeKey: 'e2e-tax',
    title: 'E2E tax v2',
    body: 'Rate range 0-200',
  })
  await call('POST', `/agent-knowledge/${knowledgeV2.id}/publish`, { confirmedSensitive: true })
  const publishedV2 = await call('GET', '/agent-knowledge/published')
  assert(publishedV2.some((row) => row.id === knowledgeV2.id), 'published knowledge v2 visible')

  const unpublished = await call('POST', '/agent-knowledge/drafts', {
    scope: 'organization',
    knowledgeKey: 'e2e-unpublished',
    title: 'Unpublished',
    body: 'should not be visible',
  })
  const publishedBefore = await call('GET', '/agent-knowledge/published')
  assert(!publishedBefore.some((row) => row.id === unpublished.id), 'unpublished knowledge not visible')

  const rollbackDraft = await call('POST', `/agent-knowledge/${knowledgeV2.id}/rollback`, {})
  await call('POST', `/agent-knowledge/${rollbackDraft.id}/publish`, { confirmedSensitive: true })
  const publishedAfterRollback = await call('GET', '/agent-knowledge/published')
  const activeTax = publishedAfterRollback.find((row) => row.knowledgeKey === 'e2e-tax' && row.status === 'published')
  console.log('afterRollback=', JSON.stringify(publishedAfterRollback.filter(r=>r.knowledgeKey==='e2e-tax')));
  assert(activeTax?.body === 'Rate range 0-100. Contact 13800138000', 'knowledge rollback restores old content')

  const streamResponse = await fetch(`${base}/agent/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: '\u5217\u51fa\u5df2\u767b\u8bb0\u7684\u84dd\u56fe', appKey: 'erp-purchase', appInstallationId: installation }),
  })
  const streamText = await streamResponse.text()
  console.log('sseStatus=', streamResponse.status, 'sseHead=', streamText.slice(0,300));
  assert(streamResponse.ok && streamText.includes('event: turn.start'), 'PiAgent SSE stream')
  assert(streamText.includes('event: tool.start') || streamText.includes('event: plan'), 'PiAgent emitted tool/plan event')
  assert(streamText.includes('[kn:'), 'PiAgent cited published knowledge')
  const conversationId = streamResponse.headers.get('x-conversation-id')
  assert(Boolean(conversationId), 'SSE exposes conversation id')
  const history = await call('GET', `/agent/conversations/${conversationId}`)
  assert(Array.isArray(history?.turns) && history.turns.length > 0, 'agent history persisted')

  const preview = await call('POST', `/builder/releases/${releaseId}/preview-token`, {})
  assert(preview?.token, 'issue preview token')
  const badPreview = await fetch(`${base}/apps/erp-purchase/preview/bad.token?releaseId=${releaseId}`, { headers })
  assert(badPreview.status === 403, 'invalid preview token is 403')

  await call('POST', '/release-automation/erp-purchase/policy', {
    autonomy: 'A2',
    enabled: true,
    allowedChangeClasses: ['copy'],
    guardrails: { errorRate: 0.01 },
    autoRollbackEnabled: true,
    canaryStages: [5, 25, 100],
  })
  const a2Release = await call('POST', '/release-automation/erp-purchase/publish', {
    changeClasses: ['copy'],
    version: a2Version,
    manifest: { entities: {} },
    changelog: { 'zh-CN': [{ type: 'changed', title: 'E2E copy change' }] },
  })
  assert(a2Release?.channel === 'canary', 'A2 publish to canary')
  const audit = await call('GET', '/release-automation/audit/quarterly')
  assert(audit?.ok === true && audit.structuralAutoPublishes === 0, 'A2 quarterly audit')

  const rollback = await call(
    'POST',
    `/builder/releases/${releaseId}/rollback`,
    { appInstallationId: installation, reason: 'e2e rollback' },
    { 'Idempotency-Key': `e2e-rollback-${suffix}` },
  )
  assert(rollback?.result?.action === 'rollback', 'rollback appends activation')

  console.log('E2E OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
