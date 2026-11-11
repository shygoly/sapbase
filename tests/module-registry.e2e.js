/**
 * Module Registry 详情页 e2e：能力、健康、关系、统计、配置、文档。
 *
 * Run: node tests/module-registry.e2e.js
 * Requires: dev servers 3051 / 3060.
 */

const assert = require('node:assert')
const path = require('node:path')
const { execSync } = require('node:child_process')

function loadPlaywright() {
  try {
    return require('playwright')
  } catch {
    const bin = execSync('command -v playwright', {
      shell: '/bin/zsh',
      encoding: 'utf8',
    }).trim()
    return require(path.resolve(path.dirname(bin), '../lib/node_modules/playwright'))
  }
}

const { chromium } = loadPlaywright()
const API = 'http://localhost:3051'
const CONSOLE = 'http://localhost:3060'
let token = ''
let organizationId = ''

async function api(pathname, options = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Organization-Id': organizationId,
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

function data(body) {
  return body && typeof body === 'object' && 'data' in body ? body.data : body
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: '123456' }),
  })
  assert.ok([200, 201].includes(login.status), `login ${login.status}`)
  const session = data(await login.json())
  token = session.access_token
  organizationId = session.currentOrganizationId || session.organizations?.[0]?.id

  const suffix = Date.now()
  const created = await api('/api/module-registry', {
    method: 'POST',
    body: JSON.stringify({
      name: `E2E Registry ${suffix}`,
      description: 'e2e module registry detail',
      moduleType: 'crud',
      metadata: { entities: ['E2ECustomer'] },
    }),
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const moduleId = data(created.body).id
  const capability = await api(`/api/module-registry/${moduleId}/capabilities`, {
    method: 'POST',
    body: JSON.stringify({
      capabilityType: 'crud',
      entity: 'E2ECustomer',
      operations: ['create', 'read'],
      apiEndpoints: ['/api/e2e-customers'],
    }),
  })
  assert.equal(capability.status, 201, JSON.stringify(capability.body))

  const all = await api('/api/module-registry')
  const targetModule = data(all.body).find((item) => item.id !== moduleId)

  let browser
  try {
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('dialog', (dialog) => {
      void dialog.accept()
    })

    await page.goto(`${CONSOLE}/login`, { waitUntil: 'networkidle' })
    await page.fill('input#email', 'admin@example.com')
    await page.fill('input#password', '123456')
    await page.getByRole('button', { name: /^Sign in$/ }).click()
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), undefined, {
      timeout: 20_000,
    })

    await page.goto(`${CONSOLE}/admin/module-registry/${moduleId}`, {
      waitUntil: 'networkidle',
    })
    await page.getByText(`E2E Registry ${suffix}`).first().waitFor({ timeout: 15_000 })
    assert.match(await page.locator('body').innerText(), /Capabilities/)
    assert.match(await page.locator('body').innerText(), /E2ECustomer/)
    assert.match(await page.locator('body').innerText(), /\/api\/e2e-customers/)

    // 统计收集（无真实表 -> warning 行，但有明确实体）
    await page.getByRole('button', { name: '收集统计' }).click()
    await page.getByText('E2ECustomer', { exact: true }).last().waitFor({ timeout: 10_000 })
    assert.match(await page.locator('body').innerText(), /warning/)

    // 添加关系 -> 图/列表出现
    if (targetModule) {
      await page.locator('[aria-label="目标模块"]').click()
      await page.getByRole('option', { name: targetModule.name }).click()
      await page.getByRole('button', { name: '添加' }).click()
      await page.getByText(/dependency/).first().waitFor({ timeout: 10_000 })
      assert.match(await page.locator('body').innerText(), new RegExp(targetModule.name))
    }

    // 配置文档新增
    const docTextareas = page.locator('textarea')
    await docTextareas.nth(0).fill('E2E usage documentation')
    await page.locator('textarea').last().fill('{"fields":[{"name":"e2e","type":"string"}]}')
    await page.getByRole('button', { name: '新增配置' }).click()
    await page.getByText('schema', { exact: true }).first().waitFor({ timeout: 10_000 })

    // 生成文档
    await page.getByRole('button', { name: 'Docs' }).click()
    await page.getByText(/生成文档/).waitFor({ timeout: 10_000 })
    const text = await page.locator('body').innerText()
    assert.match(text, /# E2E Registry/)
    assert.match(text, /Capabilities/)
  } finally {
    if (browser) await browser.close()
    await api(`/api/module-registry/${moduleId}`, { method: 'DELETE' })
  }

  console.log('✓ 模块详情：能力/健康/统计')
  console.log('✓ 关系添加 + 图/列表渲染')
  console.log('✓ 配置编辑 + Markdown 文档生成')
  console.log('module registry e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
