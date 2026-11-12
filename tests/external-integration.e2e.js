/**
 * 外部集成 e2e：连接器/secretRef/出站 4xx/5xx/OAuth2、入站 Webhook HMAC/重放、
 * 只读 Postgres 增量同步/水位/对账、服务令牌 scope。
 *
 * 需要 API 环境：
 *   INTEGRATION_E2E_SECRET=e2e-secret
 *   INTEGRATION_DB_SECRET='{"user":"mac","password":""}'
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { createHmac } = require('node:crypto')
const http = require('node:http')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'
const SECRET = 'e2e-secret'

function sql(statement) {
  return execFileSync('psql', ['-d', DB, '-tAc', statement], { encoding: 'utf8' }).trim()
}

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
  const wait = async (fn, timeout = 60_000) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const value = await fn()
      if (value) return value
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error('timeout')
  }

  const suffix = Date.now()
  const keyPrefix = `e2e-int-${suffix}`
  const connectorIds = []
  const webhookIds = []
  const sourceIds = []
  const syncJobIds = []
  const serviceClientIds = []
  let server
  let createdStudents = false

  try {
    let echoCalls = 0
    let flakyCalls = 0
    let authHeader = null
    server = http.createServer(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = Buffer.concat(chunks).toString('utf8')
      if (req.url === '/echo') {
        echoCalls += 1
        authHeader = req.headers.authorization ?? null
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, echo: JSON.parse(body || '{}') }))
        return
      }
      if (req.url === '/bad') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end('{"error":"bad"}')
        return
      }
      if (req.url === '/flaky') {
        flakyCalls += 1
        if (flakyCalls < 3) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end('{"error":"flaky"}')
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
        return
      }
      if (req.url === '/token') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"access_token":"oauth-token","expires_in":3600}')
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    const base = `http://127.0.0.1:${port}`

    const createConnector = async (key, config, secretRef = 'env:INTEGRATION_E2E_SECRET') => {
      const result = await call('/api/integrations/connectors', {
        method: 'POST',
        body: JSON.stringify({
          key,
          name: key,
          type: 'rest',
          config: { ...config, allowlist: ['127.0.0.1'] },
          secretRef,
        }),
      })
      assert.equal(result.status, 201, JSON.stringify(result.data))
      connectorIds.push(result.data.id)
      return result.data
    }

    // SSRF：元数据地址拒绝
    const ssrf = await call('/api/integrations/connectors', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-ssrf`,
        name: 'ssrf',
        type: 'rest',
        config: { endpoint: 'http://169.254.169.254/latest/meta-data' },
      }),
    })
    assert.equal(ssrf.status, 400, JSON.stringify(ssrf.data))

    // Bearer 出站 + 幂等
    const rest = await createConnector(`${keyPrefix}-rest`, {
      endpoint: `${base}/echo`,
      authType: 'bearer',
    })
    const messageBody = {
      eventType: 'student.created',
      payload: { studentNo: 'S1' },
      idempotencyKey: `${keyPrefix}-out-1`,
    }
    const firstMessage = await call(`/api/integrations/connectors/${rest.id}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageBody),
    })
    assert.equal(firstMessage.status, 201, JSON.stringify(firstMessage.data))
    const duplicate = await call(`/api/integrations/connectors/${rest.id}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageBody),
    })
    assert.equal(duplicate.data.id, firstMessage.data.id)
    const delivered = await wait(async () => {
      const current = await call(`/api/integrations/outbound/${firstMessage.data.id}`)
      return current.data?.status === 'succeeded' ? current.data : null
    })
    assert.equal(delivered.attempts, 1)
    assert.equal(authHeader, `Bearer ${SECRET}`)
    assert.equal(echoCalls, 1)

    // 4xx 不重试 → dead
    const bad = await createConnector(`${keyPrefix}-bad`, { endpoint: `${base}/bad` })
    const badMessage = await call(`/api/integrations/connectors/${bad.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'bad',
        payload: {},
        idempotencyKey: `${keyPrefix}-bad-1`,
      }),
    })
    const dead = await wait(async () => {
      const current = await call(`/api/integrations/outbound/${badMessage.data.id}`)
      return current.data?.status === 'dead' ? current.data : null
    })
    assert.equal(dead.attempts, 1)
    assert.equal(dead.responseStatus, 400)

    // 5xx 重试 → succeeded
    const flaky = await createConnector(`${keyPrefix}-flaky`, {
      endpoint: `${base}/flaky`,
      maxAttempts: 4,
    })
    const flakyMessage = await call(`/api/integrations/connectors/${flaky.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'flaky',
        payload: {},
        idempotencyKey: `${keyPrefix}-flaky-1`,
      }),
    })
    const recovered = await wait(async () => {
      const current = await call(`/api/integrations/outbound/${flakyMessage.data.id}`)
      return current.data?.status === 'succeeded' ? current.data : null
    }, 30_000)
    assert.equal(recovered.attempts, 3)

    // OAuth2 client credentials
    const oauth = await createConnector(`${keyPrefix}-oauth`, {
      endpoint: `${base}/echo`,
      authType: 'oauth2',
      tokenUrl: `${base}/token`,
      clientId: 'e2e-client',
    })
    const oauthMessage = await call(`/api/integrations/connectors/${oauth.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'oauth',
        payload: {},
        idempotencyKey: `${keyPrefix}-oauth-1`,
      }),
    })
    await wait(async () => {
      const current = await call(`/api/integrations/outbound/${oauthMessage.data.id}`)
      return current.data?.status === 'succeeded' ? current.data : null
    })
    assert.equal(authHeader, 'Bearer oauth-token')

    // 入站 Webhook：HMAC/幂等/签名错/过期
    const endpoint = await call('/api/integrations/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-hook`,
        name: 'hook',
        secretRef: 'env:INTEGRATION_E2E_SECRET',
        eventType: 'student.updated',
        mapping: { topic: 'integration.webhook.student.updated' },
      }),
    })
    assert.equal(endpoint.status, 201, JSON.stringify(endpoint.data))
    webhookIds.push(endpoint.data.id)
    const eventId = `${keyPrefix}-event-1`
    const timestamp = String(Math.floor(Date.now() / 1000))
    const payload = JSON.stringify({ studentNo: 'S1', name: 'Alice' })
    const signature = createHmac('sha256', SECRET)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    const hookPath = `/api/integrations/webhooks/${org}/${keyPrefix}-hook`
    const hook = await call(hookPath, {
      method: 'POST',
      headers: {
        'x-signature': signature,
        'x-timestamp': timestamp,
        'x-event-id': eventId,
        'x-event-type': 'student.updated',
      },
      body: payload,
    })
    assert.equal(hook.status, 200, JSON.stringify(hook.data))
    assert.equal(hook.data.status, 'processed')
    const duplicateHook = await call(hookPath, {
      method: 'POST',
      headers: {
        'x-signature': signature,
        'x-timestamp': timestamp,
        'x-event-id': eventId,
      },
      body: payload,
    })
    assert.equal(duplicateHook.data.duplicate, true)
    const badSignature = await call(hookPath, {
      method: 'POST',
      headers: {
        'x-signature': 'deadbeef',
        'x-timestamp': timestamp,
        'x-event-id': `${eventId}-bad`,
      },
      body: payload,
    })
    assert.equal(badSignature.status, 403)
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600)
    const oldSignature = createHmac('sha256', SECRET)
      .update(`${oldTimestamp}.${payload}`)
      .digest('hex')
    const expired = await call(hookPath, {
      method: 'POST',
      headers: {
        'x-signature': oldSignature,
        'x-timestamp': oldTimestamp,
        'x-event-id': `${eventId}-old`,
      },
      body: payload,
    })
    assert.equal(expired.status, 403)
    const eventList = await call('/api/integrations/webhook-events')
    assert.ok(eventList.data.some((item) => item.eventId === eventId && item.status === 'processed'))

    // 只读 Postgres 增量同步
    sql(`CREATE TABLE IF NOT EXISTS students (
      student_no text PRIMARY KEY,
      name text,
      class_name text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
    createdStudents = true
    for (let index = 1; index <= 3; index += 1) {
      sql(
        `INSERT INTO students (student_no,name,class_name,updated_at) VALUES ('${keyPrefix}-s${index}','Student ${index}','Class 1', now() - interval '${index} minute') ON CONFLICT (student_no) DO NOTHING`,
      )
    }
    const source = await call('/api/integrations/data-sources', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-db`,
        name: 'e2e db',
        dbType: 'postgres',
        host: '127.0.0.1',
        port: 5432,
        database: DB,
        ssl: false,
        secretRef: 'env:INTEGRATION_DB_SECRET',
        allowlist: ['127.0.0.1'],
      }),
    })
    assert.equal(source.status, 201, JSON.stringify(source.data))
    sourceIds.push(source.data.id)
    const tested = await call(`/api/integrations/data-sources/${source.data.id}/test`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(tested.data.ok, true, JSON.stringify(tested.data))

    const syncJob = await call('/api/integrations/sync-jobs', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-sync`,
        name: 'students sync',
        dataSourceId: source.data.id,
        queryTemplate: 'students_incremental',
        targetResourceKey: 'platform:departments',
        fieldMapping: {
          name: 'studentNo',
          description: 'name',
          status: { default: 'active' },
        },
        mode: 'incremental',
        cursorField: 'updatedAt',
        batchSize: 50,
      }),
    })
    assert.equal(syncJob.status, 201, JSON.stringify(syncJob.data))
    syncJobIds.push(syncJob.data.id)
    const run1 = await call(`/api/integrations/sync-jobs/${syncJob.data.id}/run`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(run1.status, 201, JSON.stringify(run1.data))
    const done1 = await wait(async () => {
      const runs = await call(`/api/integrations/sync-runs?jobId=${syncJob.data.id}`)
      const run = runs.data.find((item) => item.id === run1.data.id)
      return run && !['queued', 'running'].includes(run.status) ? run : null
    })
    assert.equal(done1.status, 'succeeded', JSON.stringify(done1))
    assert.equal(done1.rowsRead, 3)
    assert.equal(done1.rowsWritten, 3)
    assert.ok(done1.diff.sourceChecksum)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name LIKE '${keyPrefix}-s%'`)),
      3,
    )

    // 水位：无新数据 → 0 行
    const run2 = await call(`/api/integrations/sync-jobs/${syncJob.data.id}/run`, {
      method: 'POST',
      body: '{}',
    })
    const done2 = await wait(async () => {
      const runs = await call(`/api/integrations/sync-runs?jobId=${syncJob.data.id}`)
      const run = runs.data.find((item) => item.id === run2.data.id)
      return run && !['queued', 'running'].includes(run.status) ? run : null
    })
    assert.equal(done2.rowsRead, 0)

    // 新数据 → 1 行
    sql(
      `INSERT INTO students (student_no,name,class_name,updated_at) VALUES ('${keyPrefix}-s4','Student 4','Class 1', now() + interval '1 second')`,
    )
    const run3 = await call(`/api/integrations/sync-jobs/${syncJob.data.id}/run`, {
      method: 'POST',
      body: '{}',
    })
    const done3 = await wait(async () => {
      const runs = await call(`/api/integrations/sync-runs?jobId=${syncJob.data.id}`)
      const run = runs.data.find((item) => item.id === run3.data.id)
      return run && !['queued', 'running'].includes(run.status) ? run : null
    })
    assert.equal(done3.rowsRead, 1)
    assert.equal(done3.rowsWritten, 1)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name LIKE '${keyPrefix}-s%'`)),
      4,
    )

    // 服务令牌 scope
    const client = await call('/api/identity/service-clients', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-svc`,
        name: 'e2e service',
        scopes: ['integrations.read'],
      }),
    })
    assert.equal(client.status, 201, JSON.stringify(client.data))
    serviceClientIds.push(client.data.client.id)
    const whoami = await fetch(`${API}/api/integrations/external/whoami`, {
      headers: {
        'X-Organization-Id': org,
        'X-Service-Key': `${keyPrefix}-svc`,
        'X-Service-Secret': client.data.secret,
      },
    })
    assert.equal(whoami.status, 200)
    const wrongScope = await call('/api/identity/service-clients', {
      method: 'POST',
      body: JSON.stringify({
        key: `${keyPrefix}-svc-bad`,
        name: 'e2e service bad',
        scopes: ['other.read'],
      }),
    })
    serviceClientIds.push(wrongScope.data.client.id)
    const forbidden = await fetch(`${API}/api/integrations/external/whoami`, {
      headers: {
        'X-Organization-Id': org,
        'X-Service-Key': `${keyPrefix}-svc-bad`,
        'X-Service-Secret': wrongScope.data.secret,
      },
    })
    assert.equal(forbidden.status, 403)

    const metrics = await call('/api/integrations/metrics')
    assert.ok(metrics.data.outbound.total >= 4)
    assert.ok(metrics.data.sync.rowsRead >= 4)

    console.log('✓ 连接器/secretRef/SSRF；出站 Bearer/幂等/4xx dead/5xx 重试/OAuth2')
    console.log('✓ Webhook HMAC/时间戳/重复/签名错；只读 Postgres 增量同步/水位/对账')
    console.log('✓ 服务令牌 scope 200/403')
    console.log('external integration e2e passed')
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (syncJobIds.length > 0) {
      const ids = syncJobIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM data_sync_runs WHERE "jobId" IN (${ids})`)
      sql(`DELETE FROM data_sync_jobs WHERE id IN (${ids})`)
    }
    if (sourceIds.length > 0) {
      sql(`DELETE FROM data_sources WHERE id IN (${sourceIds.map((id) => `'${id}'`).join(',')})`)
    }
    if (webhookIds.length > 0) {
      const ids = webhookIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM webhook_events WHERE "endpointId" IN (${ids})`)
      sql(`DELETE FROM webhook_endpoints WHERE id IN (${ids})`)
    }
    if (connectorIds.length > 0) {
      const ids = connectorIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM outbound_messages WHERE "connectorId" IN (${ids})`)
      sql(`DELETE FROM integration_connectors WHERE id IN (${ids})`)
    }
    if (serviceClientIds.length > 0) {
      sql(`DELETE FROM service_clients WHERE id IN (${serviceClientIds.map((id) => `'${id}'`).join(',')})`)
    }
    sql(`DELETE FROM import_runs WHERE "idempotencyKey" LIKE 'sync:%'`)
    sql(`DELETE FROM departments WHERE "organizationId"='${org}' AND name LIKE '${keyPrefix}-s%'`)
    if (createdStudents) sql('DROP TABLE IF EXISTS students')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
