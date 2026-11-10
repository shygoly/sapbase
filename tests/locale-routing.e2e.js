/**
 * Locale routing e2e.
 *
 * Run: node tests/locale-routing.e2e.js
 * Requires: dev servers on 3050 / 3060 (API on 3051), seeded admin@example.com / 123456.
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

async function login(page, base) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Sign in$/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
}


async function mockSso(page, returnUrl) {
  await page.addInitScript((url) => {
    sessionStorage.setItem(
      'sso:pending',
      JSON.stringify({
        providerKey: 'demo',
        organizationId: 'org-demo',
        state: 'state-1',
        nonce: 'nonce-1',
        returnUrl: url,
      }),
    )
  }, returnUrl)

  await page.route('**/api/auth/sso/**/callback**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: {
          access_token: 'e2e-token',
          user: {
            id: 'e2e',
            email: 'e2e@example.com',
            name: 'E2E User',
            permissions: [],
          },
          organizations: [],
          currentOrganizationId: '',
        },
      }),
    })
  })
}

;(async () => {
  const browser = await chromium.launch()

  try {
    const portal = await browser.newContext()

    await test('portal login lands on /dashboard/overview', async () => {
      const page = await portal.newPage()
      await login(page, PORTAL)
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      await page.close()
    })

    await test('locale switch keeps URL and survives reload', async () => {
      const page = await portal.newPage()
      await page.goto(`${PORTAL}/dashboard/overview`, { waitUntil: 'networkidle' })
      await portal.addCookies([
        { name: 'NEXT_LOCALE', value: 'zh', domain: 'localhost', path: '/' },
      ])
      await page.reload({ waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      assert.strictEqual(await page.locator('html').getAttribute('lang'), 'zh')
      await page.close()
    })

    await test('server HTML already has the negotiated lang (no flash)', async () => {
      const response = await portal.request.get(`${PORTAL}/dashboard/overview`)
      const html = await response.text()
      assert.match(html, /<html lang="zh"/)
    })

    await test('/en/dashboard/overview 307s to /dashboard/overview', async () => {
      const page = await portal.newPage()
      await page.goto(`${PORTAL}/en/dashboard/overview`, { waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      await page.close()
    })

    await test('?lang=ko applies the override and removes the param', async () => {
      const page = await portal.newPage()
      await page.goto(`${PORTAL}/dashboard/overview?lang=ko`, { waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      assert.strictEqual(new URL(page.url()).search, '')
      assert.strictEqual(await page.locator('html').getAttribute('lang'), 'ko')
      await page.close()
    })

    await test('/docs/plugin renders without a locale prefix', async () => {
      const page = await portal.newPage()
      const response = await page.goto(`${PORTAL}/docs/plugin`, { waitUntil: 'domcontentloaded' })
      assert.strictEqual(response.status(), 200)
      await page.close()
    })

    await test('/invitations/demo renders', async () => {
      const page = await portal.newPage()
      const response = await page.goto(`${PORTAL}/invitations/demo`, {
        waitUntil: 'domcontentloaded',
      })
      assert.strictEqual(response.status(), 200)
      await page.close()
    })


    await test('portal /profile redirects to /dashboard/profile', async () => {
      const response = await portal.request.get(`${PORTAL}/profile`, {
        maxRedirects: 0,
      })
      assert.strictEqual(response.status(), 307)
      assert.strictEqual(response.headers()['location'], '/dashboard/profile')
    })

    await test('portal /admin/* redirects to the console', async () => {
      const response = await portal.request.get(`${PORTAL}/admin/users`, {
        maxRedirects: 0,
      })
      assert.strictEqual(response.status(), 307)
      assert.strictEqual(
        response.headers()['location'],
        `${CONSOLE}/admin/users`,
      )
    })

    await test('SSO callback without a pending session shows the fallback', async () => {
      const page = await portal.newPage()
      await page.goto(`${PORTAL}/login/sso/callback`, { waitUntil: 'networkidle' })
      const text = await page.locator('body').innerText()
      assert.match(text, /登录会话已过期/)
      await page.close()
    })

    await test('portal SSO callback returns to a stable path', async () => {
      const ssoCtx = await browser.newContext()
      const page = await ssoCtx.newPage()
      await mockSso(page, '/dashboard/overview')
      await page.goto(`${PORTAL}/login/sso/callback?state=state-1&code=abc`, {
        waitUntil: 'networkidle',
      })
      await page.waitForURL('**/dashboard/overview', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard/overview')
      await ssoCtx.close()
    })

    const consoleCtx = await browser.newContext()

    await test('console login lands on /admin/users', async () => {
      const page = await consoleCtx.newPage()
      await login(page, CONSOLE)
      assert.strictEqual(new URL(page.url()).pathname, '/admin/users')
      await page.close()
    })

    await test('console /en/admin/users 307s to /admin/users', async () => {
      const page = await consoleCtx.newPage()
      await page.goto(`${CONSOLE}/en/admin/users`, { waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/users')
      await page.close()
    })


    await test('console /dashboard/* redirects to the portal', async () => {
      const response = await consoleCtx.request.get(`${CONSOLE}/dashboard/overview`, {
        maxRedirects: 0,
      })
      assert.strictEqual(response.status(), 307)
      assert.strictEqual(
        response.headers()['location'],
        `${PORTAL}/dashboard/overview`,
      )
    })

    await test('console /docs/* redirects to the portal', async () => {
      const response = await consoleCtx.request.get(`${CONSOLE}/docs/plugin`, {
        maxRedirects: 0,
      })
      assert.strictEqual(response.status(), 307)
      assert.strictEqual(response.headers()['location'], `${PORTAL}/docs/plugin`)
    })

    await test('console /profile renders inside the app shell', async () => {
      const page = await consoleCtx.newPage()
      const response = await page.goto(`${CONSOLE}/profile`, { waitUntil: 'networkidle' })
      assert.strictEqual(response.status(), 200)
      assert.strictEqual(new URL(page.url()).pathname, '/profile')
      const text = await page.locator('body').innerText()
      assert.match(text, /Account details/)
      await page.close()
    })

    await test('console / lands on /admin/releases', async () => {
      const page = await consoleCtx.newPage()
      await page.goto(`${CONSOLE}/`, { waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/releases')
      await page.close()
    })


    await test('console SSO callback returns to a stable path', async () => {
      const ssoCtx = await browser.newContext()
      const page = await ssoCtx.newPage()
      await mockSso(page, '/admin/users')
      await page.goto(`${CONSOLE}/login/sso/callback?state=state-1&code=abc`, {
        waitUntil: 'networkidle',
      })
      await page.waitForURL('**/admin/users', { timeout: 15000 })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/users')
      await ssoCtx.close()
    })

    await test('console ?lang=ja sets the locale without changing the path', async () => {
      const page = await consoleCtx.newPage()
      await page.goto(`${CONSOLE}/admin/users?lang=ja`, { waitUntil: 'networkidle' })
      assert.strictEqual(new URL(page.url()).pathname, '/admin/users')
      assert.strictEqual(new URL(page.url()).search, '')
      assert.strictEqual(await page.locator('html').getAttribute('lang'), 'ja')
      await page.close()
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
