/**
 * 教育 Agent e2e：加载 agents.json 定义，经真实默认模型产出草稿；
 * 写操作未确认时必须停在 requires-confirmation。
 */

const assert = require('node:assert')
const { rmSync } = require('node:fs')
const { join } = require('node:path')

const API = process.env.API_BASE || 'http://localhost:3051'

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
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org,
    'Content-Type': 'application/json',
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }
  const packageId = 'education-1.0.0'
  const packageFile = join(process.cwd(), 'blueprints', `${packageId}.erpkg`)
  try {
    await call('/api/blueprints/package', {
      method: 'POST',
      body: JSON.stringify({ dir: join(process.cwd(), 'templates/education'), out: packageFile }),
    })
    const loaded = await call(`/api/blueprints/${packageId}/load`, { method: 'POST', body: '{}' })
    assert.equal(loaded.status, 200, JSON.stringify(loaded.data).slice(0, 500))
    assert.equal(loaded.data.compiled.agents.items.length, 7)

    const confirmRequired = await call(
      `/api/blueprints/${packageId}/agents/edu-outline/run`,
      { method: 'POST', body: JSON.stringify({ input: '生成 3 章课程大纲' }) },
    )
    assert.equal(confirmRequired.status, 200, JSON.stringify(confirmRequired.data))
    assert.equal(confirmRequired.data.status, 'requires-confirmation')

    const outline = await call(`/api/blueprints/${packageId}/agents/edu-outline/run`, {
      method: 'POST',
      body: JSON.stringify({ input: '生成 3 章课程大纲', confirm: true }),
    })
    assert.equal(outline.status, 200, JSON.stringify(outline.data))
    assert.equal(outline.data.status, 'draft')
    assert.ok(outline.data.draft && outline.data.draft.length > 10)

    const question = await call(`/api/blueprints/${packageId}/agents/edu-question-gen/run`, {
      method: 'POST',
      body: JSON.stringify({ input: '为光合作用生成 2 道单选题', confirm: true }),
    })
    assert.equal(question.status, 200, JSON.stringify(question.data))
    assert.ok(question.data.draft)

    const tutoring = await call(`/api/blueprints/${packageId}/agents/edu-tutoring/run`, {
      method: 'POST',
      body: JSON.stringify({ input: '光合作用为什么需要光照？' }),
    })
    assert.equal(tutoring.status, 200, JSON.stringify(tutoring.data))
    assert.ok(tutoring.data.draft)

    console.log('✓ agents.json 7 定义加载；写 Agent 未确认 → requires-confirmation')
    console.log('✓ 真实模型草稿：大纲/出题/答疑')
    console.log('education agent e2e passed')
  } finally {
    rmSync(packageFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
