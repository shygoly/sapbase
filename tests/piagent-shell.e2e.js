/**
 * PiAgent 壳层面板 e2e：固定入口、悬浮球、上下文芯片、帮助/代操、确认令牌。
 *
 * Run: node tests/piagent-shell.e2e.js
 * Requires: dev servers 3050 / 3051.
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

const planResponse = {
  code: 200,
  data: {
    kind: 'plan',
    intent: 'help',
    plan: {
      plan: 'interaction-plan/v1',
      surface: 'piagent-help',
      title: '当前页说明',
      blocks: [
        {
          kind: 'facts',
          items: [
            { label: '页面', value: 'Dashboard' },
            { label: '说明', value: '这是工作台概览页。' },
          ],
        },
      ],
      actions: [
        {
          kind: 'confirm',
          id: 'create-record',
          label: '创建示例记录',
          tool: 'record.create',
          args: { entity: 'demo' },
        },
        { kind: 'cancel', id: 'cancel', label: '取消' },
      ],
      trace: { tools: ['record.create'], intent: 'help' },
      needsConfirmation: true,
    },
  },
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const calls = { chat: 0, confirm: 0, invoke: [] }

  await page.route('**/api/chat/message', async (route) => {
    calls.chat += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(planResponse),
    })
  })
  await page.route('**/api/agent-tools/record.create/confirm', async (route) => {
    calls.confirm += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: {
          token: 'confirmation-token',
          tool: 'record.create',
          argsDigest: 'sha256:test',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
    })
  })
  await page.route('**/api/agent-tools/record.create/invoke', async (route) => {
    calls.invoke.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: { ok: true, tool: 'record.create', result: { id: 'r1' } },
      }),
    })
  })

  await page.goto(`${PORTAL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input#email', 'admin@example.com')
  await page.fill('input#password', '123456')
  await page.getByRole('button', { name: /^Sign in$/ }).click()
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login'),
    undefined,
    { timeout: 20_000 },
  )
  await page.goto(`${PORTAL}/dashboard/overview`, { waitUntil: 'networkidle' })

  // 固定入口打开面板；上下文芯片可移除
  await page.getByRole('button', { name: '打开 PiAgent 助手', exact: true }).click()
  const panel = page.locator('[data-piagent-panel="true"]')
  await panel.waitFor({ state: 'visible' })
  assert.match(await panel.innerText(), /用法答疑/)
  assert.match(await panel.innerText(), /路由：/)
  assert.match(await panel.innerText(), /组织：/)
  await panel.getByRole('button', { name: '移除上下文 org' }).click()
  assert.doesNotMatch(await panel.innerText(), /组织：/)

  // 协助模式快捷语（空态）；随后回到帮助意图
  await panel.getByRole('button', { name: '协助操作' }).click()
  assert.match(await panel.innerText(), /帮我查当前页的数据/)
  await panel.getByRole('button', { name: '用法答疑' }).click()

  // 帮助意图 -> 计划渲染 -> 确认卡 -> 确认令牌消费
  await panel.getByRole('button', { name: '这页怎么用？' }).click()
  await panel.getByText('当前页说明').waitFor({ timeout: 10_000 })
  assert.equal(calls.chat, 1)
  await panel.getByRole('button', { name: '创建示例记录' }).click()
  await panel.getByText(/已执行（确认令牌已消费）/).waitFor({ timeout: 10_000 })
  assert.equal(calls.confirm, 1)
  assert.equal(calls.invoke.length, 1)
  assert.equal(calls.invoke[0].confirmationToken, 'confirmation-token')

  // 悬浮球：隐藏后固定入口仍可打开同一面板
  await panel.getByRole('button', { name: '关闭 PiAgent 助手' }).click()
  const ball = page.getByRole('button', { name: '打开 PiAgent 助手（悬浮球）' })
  await ball.waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '隐藏悬浮球' }).click()
  await ball.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: '打开 PiAgent 助手', exact: true }).click()
  await panel.waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-piagent-panel="true"]').count(), 1)

  await page.screenshot({ path: '/tmp/piagent-shell.png', fullPage: false })
  await browser.close()
  console.log('✓ 固定入口/悬浮球打开同一面板')
  console.log('✓ 上下文芯片可移除；帮助/协助两种意图')
  console.log('✓ 确认卡 -> 平台确认令牌 -> invoke')
  console.log('piagent shell e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
