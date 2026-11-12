/**
 * 教育参考蓝图签名/交付/装载 e2e。
 * 需要 API 环境：BLUEPRINT_LICENSE_PRIVATE_KEY + BLUEPRINT_LICENSE_PUBLIC_KEYS，
 * 且 BLUEPRINT_ALLOW_UNSIGNED=false。
 */

const assert = require('node:assert')

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
  if (!process.env.BLUEPRINT_LICENSE_PRIVATE_KEY || !process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS) {
    console.log('… 跳过签名 e2e（未配置蓝图签名密钥）')
    return
  }
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
  const delivered = await call('/api/blueprints/education/deliver', {
    method: 'POST',
    body: JSON.stringify({ grantedTo: [org], issuer: 'e2e' }),
  })
  assert.equal(delivered.status, 200, JSON.stringify(delivered.data))
  assert.ok(delivered.data.manifest.signature, 'signed manifest missing')
  const loaded = await call(`/api/blueprints/${delivered.data.id}/load`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(loaded.status, 200, JSON.stringify(loaded.data).slice(0, 500))
  assert.equal(loaded.data.compiled.agents.items.length, 7)
  console.log('✓ 教育蓝图签名交付 + 验签装载')
  console.log('education signed e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
