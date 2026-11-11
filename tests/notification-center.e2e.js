/**
 * 通知中心 / 公告 e2e。
 *
 * Run: node tests/notification-center.e2e.js
 * Requires: dev servers on 3050 / 3051 (API), seeded admin@example.com / 123456.
 *
 * 覆盖：发布→投递→已读统计→撤回、重复发布幂等、跨租户负例、
 *       WebSocket 在线推送与断线重连补发、公告复制/软删除。
 */

const assert = require('node:assert')
const { io } = require('socket.io-client')

const API = process.env.API_BASE || 'http://localhost:3051'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let token = ''
let organizationId = ''
let userId = ''

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
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

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(API, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 8_000,
    })
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('WebSocket connected timeout'))
    }, 10_000)
    socket.on('connected', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.on('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function waitNotification(socket, title, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('notification', handler)
      reject(new Error(`WebSocket notification timeout: ${title}`))
    }, timeoutMs)
    const handler = (notification) => {
      if (notification?.title !== title) return
      clearTimeout(timer)
      socket.off('notification', handler)
      resolve(notification)
    }
    socket.on('notification', handler)
  })
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: '123456' }),
  })
  assert.ok([200, 201].includes(login.status), `login status ${login.status}`)
  const session = data(await login.json())
  token = session.access_token
  organizationId = session.currentOrganizationId || session.organizations?.[0]?.id
  userId = session.user?.id
  assert.ok(token && organizationId && userId, 'login must return token/org/user')

  const suffix = Date.now()
  const title = `E2E 公告 ${suffix}`
  const secondTitle = `E2E 断线公告 ${suffix}`

  // 1. 创建（user audience = 当前管理员，作为“学生收到”的可验证替身）
  const created = await api('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title,
      body: '正文 **粗体** <script>alert(1)</script>',
      audienceType: 'user',
      audiences: [{ type: 'user', value: userId }],
      retentionDays: 30,
      attachments: [{ name: '课程表.pdf', url: 'https://example.com/schedule.pdf' }],
    }),
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const announcement = data(created.body)
  assert.equal(announcement.status, 'draft')

  // 1b. 跨租户 scope 节点：同组织外/不存在的节点必须拒绝
  const crossScope = await api('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: `${title} scope`,
      body: 'scope',
      audienceType: 'scope_node',
      audiences: [
        { type: 'scope_node', value: '00000000-0000-4000-8000-000000000000' },
      ],
    }),
  })
  assert.equal(crossScope.status, 404, JSON.stringify(crossScope.body))

  const publish = await api(`/api/announcements/${announcement.id}/publish?force=true`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(publish.status, 201, JSON.stringify(publish.body))
  assert.equal(data(publish.body).delivered, 1)

  // 2. 学生收到：通知列表出现且正文仍是原始文本（前端负责安全渲染）
  const list = await api('/api/notifications?all=true')
  assert.equal(list.status, 200)
  const received = data(list.body).notifications.filter((item) => item.title === title)
  assert.equal(received.length, 1, 'exactly one notification per user')
  assert.match(received[0].message, /<script>alert\(1\)<\/script>/)
  assert.equal(received[0].category, 'announcement')
  assert.equal(received[0].mandatory, true)

  // 3. 重复发布幂等：delivery 不翻倍
  const publishAgain = await api(`/api/announcements/${announcement.id}/publish?force=true`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(data(publishAgain.body).delivered, 1)
  const listAfter = await api('/api/notifications?all=true')
  assert.equal(
    data(listAfter.body).notifications.filter((item) => item.title === title).length,
    1,
    'repeat publish must not duplicate notification',
  )

  // 4. 已读统计
  const before = data((await api(`/api/announcements/${announcement.id}/stats`)).body)
  assert.deepEqual(before, { total: 1, delivered: 1, read: 0, failed: 0 })
  const read = await api(`/api/announcements/${announcement.id}/read`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(read.status, 201)
  const after = data((await api(`/api/announcements/${announcement.id}/stats`)).body)
  assert.deepEqual(after, { total: 1, delivered: 1, read: 1, failed: 0 })
  const deliveries = data(
    (await api(`/api/announcements/${announcement.id}/deliveries?page=1&pageSize=10`)).body,
  )
  assert.equal(deliveries.total, 1)
  assert.equal(deliveries.items[0].status, 'read')

  // 5. 跨租户负例：随机组织头必须被拒绝
  const crossTenant = await api(`/api/announcements/${announcement.id}`, {
    headers: {
      'X-Organization-Id': '00000000-0000-4000-8000-000000000000',
    },
  })
  assert.ok(
    [400, 403, 404].includes(crossTenant.status),
    `cross-tenant must be rejected, got ${crossTenant.status}`,
  )
  assert.notEqual(crossTenant.status, 200)

  // 5b. 越权发布：无 announcements:manage 的销售账号必须 403
  const salesLogin = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sales@example.com', password: '123456' }),
  })
  if (salesLogin.ok) {
    const sales = data(await salesLogin.json())
    const denied = await fetch(`${API}/api/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sales.access_token}`,
        'X-Organization-Id': organizationId,
      },
      body: JSON.stringify({ title: '越权', body: 'x' }),
    })
    assert.ok([401, 403].includes(denied.status), `unauthorized publish got ${denied.status}`)
  }

  // 6. 在线推送 + 断线重连补发
  const liveTitle = `E2E 实时公告 ${suffix}`
  const socket = await connectSocket()
  const live = waitNotification(socket, liveTitle)
  const liveCreated = await api('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: liveTitle,
      body: 'live socket body',
      audienceType: 'user',
      audiences: [{ type: 'user', value: userId }],
    }),
  })
  const liveAnnouncement = data(liveCreated.body)
  const livePublish = await api(
    `/api/announcements/${liveAnnouncement.id}/publish?force=true`,
    { method: 'POST', body: '{}' },
  )
  assert.equal(data(livePublish.body).delivered, 1)
  const liveReceived = await live
  assert.equal(liveReceived.title, liveTitle)
  socket.close()

  const offline = await api('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: secondTitle,
      body: 'offline reconnect body',
      audienceType: 'user',
      audiences: [{ type: 'user', value: userId }],
    }),
  })
  const offlineAnnouncement = data(offline.body)
  const publishOffline = await api(
    `/api/announcements/${offlineAnnouncement.id}/publish?force=true`,
    { method: 'POST', body: '{}' },
  )
  assert.equal(data(publishOffline.body).delivered, 1)

  // 第一条已读，重连后补发的 pending 应包含第二条
  const reconnected = await connectSocket()
  const pending = await waitNotification(reconnected, secondTitle)
  assert.equal(pending.category, 'announcement')
  reconnected.close()

  // 7. 撤回 → 再发布拒绝；复制 → 删除
  const withdrawn = await api(`/api/announcements/${announcement.id}/withdraw`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(data(withdrawn.body).status, 'withdrawn')
  const publishWithdrawn = await api(
    `/api/announcements/${announcement.id}/publish?force=true`,
    { method: 'POST', body: '{}' },
  )
  assert.ok(
    [400, 409].includes(publishWithdrawn.status),
    `withdrawn publish must fail, got ${publishWithdrawn.status}`,
  )

  const copied = await api(`/api/announcements/${announcement.id}/copy`, {
    method: 'POST',
    body: '{}',
  })
  assert.equal(copied.status, 201)
  assert.match(data(copied.body).title, /^副本 - /)
  const copyId = data(copied.body).id
  const removedCopy = await api(`/api/announcements/${copyId}`, { method: 'DELETE' })
  assert.equal(removedCopy.status, 200)

  await api(`/api/announcements/${offlineAnnouncement.id}/withdraw`, {
    method: 'POST',
    body: '{}',
  })
  const removedSecond = await api(`/api/announcements/${offlineAnnouncement.id}`, {
    method: 'DELETE',
  })
  assert.equal(removedSecond.status, 200)
  await api(`/api/announcements/${liveAnnouncement.id}/withdraw`, {
    method: 'POST',
    body: '{}',
  })
  const removedLive = await api(`/api/announcements/${liveAnnouncement.id}`, {
    method: 'DELETE',
  })
  assert.equal(removedLive.status, 200)

  console.log('✓ 公告发布/投递/已读统计/撤回/复制/软删除')
  console.log('✓ 重复发布幂等、跨租户拒绝')
  console.log('✓ WebSocket 在线连接与断线重连 pending 补发')
  console.log('notification-center e2e passed')
  void sleep
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
