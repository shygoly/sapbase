/**
 * Auth login e2e: shared surface, both app surfaces, org selection, returnUrl.
 *
 * Run: node tests/auth-login.e2e.js
 * Requires: dev servers on 3050 / 3060 (API on 3051).
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
const PORTAL = 'http://localhost:3050'
const CONSOLE = 'http://localhost:3060'

const ORGS = [
  { id: 'org-alpha', name: 'Alpha Org', planName: 'Pro' },
  { id: 'org-beta', name: 'Beta Org', planName: 'Free' },
]

function loginBody(organizations, currentOrganizationId = '') {
  return JSON.stringify({
    code: 200,
    data: {
      access_token: 'e2e-token',
      user: {
        id: 'e2e-user',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'Admin',
        permissions: [],
      },
      organizations,
      currentOrganizationId,
    },
  })
}

async function mockProfile(page) {
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: {
          id: 'e2e-user',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'Admin',
          permissions: [],
        },
      }),
    })
  })
}

async function mockProtectedApis(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/api/auth/login') || url.includes('/api/auth/profile')) {
      return route.fallback()
    }
    let data = []
    if (url.includes('unread-count')) data = { count: 0 }
    else if (url.includes('brand-config')) data = {}
    else if (url.includes('sso/providers')) data = []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, data }),
    })
  })
}

async function mockLogin(page, calls) {
  await mockProtectedApis(page)
  await mockProfile(page)
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON()
    calls.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: body.organizationId
        ? loginBody([ORGS[1]], 'org-beta')
        : loginBody(ORGS),
    })
  })
}

async function submit(page) {
  await page.getByRole('button', { name: /^Sign in$/ }).click()
}

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
  }
}

;(async () => {
  const browser = await chromium.launch()

  try {
    await test('portal: login success lands on /dashboard/overview', async () => {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(`${PORTAL}/login`, { waitUntil: 'networkidle' })
      await submit(page)
      await page.waitForURL('**/dashboard/overview', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      await context.close()
    })

    await test('console: login success lands on /admin/users', async () => {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(`${CONSOLE}/login`, { waitUntil: 'networkidle' })
      await submit(page)
      await page.waitForURL('**/admin/users', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/users')
      await context.close()
    })

    await test('portal: multiple orgs show selector and continue with chosen org', async () => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const calls = []
      await mockLogin(page, calls)
      await page.goto(`${PORTAL}/login?returnUrl=/dashboard/chat`, {
        waitUntil: 'networkidle',
      })
      await submit(page)
      await page.locator('#org-select').waitFor({ state: 'visible', timeout: 10000 })
      await page.locator('#org-select').click()
      await page.getByRole('option', { name: /Beta Org/ }).click()
      await page.locator('#org-select').getByText('Beta Org').waitFor({ timeout: 5000 })
      await page.getByRole('button', { name: /^Continue$/ }).click()
      await page.waitForURL((url) => url.pathname === '/dashboard/chat', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/chat')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[1].organizationId, 'org-beta')
      await context.close()
    })

    await test('console: multiple orgs show selector and continue with chosen org', async () => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const calls = []
      await mockLogin(page, calls)
      await page.goto(`${CONSOLE}/login?returnUrl=/admin/roles`, {
        waitUntil: 'networkidle',
      })
      await submit(page)
      await page.locator('#org-select').waitFor({ state: 'visible', timeout: 10000 })
      await page.locator('#org-select').click()
      await page.getByRole('option', { name: /Beta Org/ }).click()
      await page.locator('#org-select').getByText('Beta Org').waitFor({ timeout: 5000 })
      await page.getByRole('button', { name: /^Continue$/ }).click()
      await page.waitForURL((url) => url.pathname === '/admin/roles', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/roles')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[1].organizationId, 'org-beta')
      await context.close()
    })

    await test('portal: returnUrl is honored after single-org login', async () => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const calls = []
      await mockProtectedApis(page)
      await mockProfile(page)
      await page.route('**/api/auth/login', async (route) => {
        calls.push(route.request().postDataJSON())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: loginBody([ORGS[1]], 'org-beta'),
        })
      })
      await page.goto(`${PORTAL}/login?returnUrl=/dashboard/billing`, {
        waitUntil: 'networkidle',
      })
      await submit(page)
      await page.waitForURL((url) => url.pathname === '/dashboard/billing', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/billing')
      await context.close()
    })
  } finally {
    await browser.close()
  }

  console.log(`\nPassed: ${passed}`)
  console.log(`Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
