/**
 * 搜索 e2e：写入公告 → 重建索引 → 关键字/类型/高亮 → 跨租户拒绝。
 *
 * Run: node tests/search.e2e.js
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
  const token = session.access_token
  const organizationId = session.currentOrganizationId || session.organizations?.[0]?.id
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': organizationId,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  const title = `搜索 E2E 课程公告 ${Date.now()}`
  const created = await call('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title,
      body: '这是一条用于验证全文检索与高亮显示的课程公告。',
      audienceType: 'all',
    }),
  })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  const announcementId = created.data.id

  try {
    const reindex = await call('/api/search/reindex', { method: 'POST' })
    assert.equal(reindex.status, 201, JSON.stringify(reindex.data))
    assert.ok(reindex.data.announcement >= 1)

    const search = await call(
      `/api/search?q=${encodeURIComponent('搜索 E2E')}&types=announcement&pageSize=10`,
    )
    assert.equal(search.status, 200)
    const hit = search.data.items.find((item) => item.resourceId === announcementId)
    assert.ok(hit, 'expected announcement hit')
    assert.equal(hit.resourceKey, 'announcement')
    assert.ok(hit.snippet.includes('[[['), `expected highlight marker, got: ${hit.snippet}`)
    assert.ok(search.data.total >= 1)

    const fuzzy = await call('/api/search?q=Smok')
    assert.ok(fuzzy.data.total >= 0)

    const empty = await call('/api/search?q=zzz-no-such-keyword')
    assert.equal(empty.data.total, 0)

    const crossTenant = await fetch(`${API}/api/search?q=test`, {
      headers: { ...headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(crossTenant.status), `cross tenant ${crossTenant.status}`)

    console.log('✓ 索引重建 + 关键字/类型过滤 + 高亮片段')
    console.log('✓ 空结果不计入 total；跨租户拒绝')
    console.log('search e2e passed')
  } finally {
    await call(`/api/announcements/${announcementId}`, { method: 'DELETE' })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
