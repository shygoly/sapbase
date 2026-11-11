/**
 * 指标 e2e：定义 → 查询/维度 → 快照/回填 → 看板 → 预警触发/恢复 → 导出 → 跨租户。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'

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
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  const suffix = Date.now()
  const metricKey = `e2e.students.${suffix}`
  const entity = `E2EStudent${suffix}`
  const blueprintId = `e2e-metrics-${suffix}`
  const ids = [randomUUID(), randomUUID(), randomUUID()]

  try {
    for (const [index, id] of ids.entries()) {
      sql(
        `INSERT INTO blueprint_records (id,"createdAt","updatedAt","organizationId","blueprintId","blueprintVersion",entity,data,state,version)
         VALUES ('${id}',now()-(interval '${index} day'),now(),'${org}','${blueprintId}','1.0.0','${entity}','${JSON.stringify({ department: index === 0 ? 'A' : 'B', name: `s${index}` })}'::jsonb,'active',1)`,
      )
    }

    const definition = await call('/api/metrics/definitions', {
      method: 'POST',
      body: JSON.stringify({
        key: metricKey,
        name: 'E2E 学生数',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
        sourceConfig: { entity },
        dimensions: ['department'],
        permissions: ['metrics:read'],
      }),
    })
    assert.equal(definition.status, 201, JSON.stringify(definition.data))
    assert.equal(definition.data.version, 1)

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() + 60_000).toISOString()
    const query = await call('/api/metrics/query', {
      method: 'POST',
      body: JSON.stringify({ metricKey, from, to, dimensions: ['department'], compare: 'previous' }),
    })
    assert.equal(query.status, 200, JSON.stringify(query.data))
    const total = query.data.items.reduce((sum, item) => sum + item.value, 0)
    assert.equal(total, 3)
    assert.ok(query.data.items.some((item) => item.dimensions.department === 'A'))
    assert.ok(query.data.comparison)

    const snapshot = await call('/api/metrics/snapshot', { method: 'POST', body: '{}' })
    assert.equal(snapshot.status, 200, JSON.stringify(snapshot.data))
    assert.ok(snapshot.data.values >= 1)
    const values = await call(`/api/metrics/definitions/${metricKey}/values?limit=5`)
    assert.ok(values.data.length >= 1)

    const dashboardKey = `e2e-dashboard-${suffix}`
    const dashboard = await call('/api/metrics/dashboards', {
      method: 'POST',
      body: JSON.stringify({
        key: dashboardKey,
        name: 'E2E 指标看板',
        visibility: {},
        widgets: [
          { key: 'total', type: 'number', metricKey, config: {} },
          { key: 'trend', type: 'line', metricKey, config: { dimensions: ['department'] } },
        ],
      }),
    })
    assert.equal(dashboard.status, 201, JSON.stringify(dashboard.data))
    const dashboardQuery = await call(`/api/metrics/dashboards/${dashboardKey}/query`, {
      method: 'POST',
      body: JSON.stringify({ from, to, compare: 'none' }),
    })
    assert.equal(dashboardQuery.status, 200, JSON.stringify(dashboardQuery.data))
    assert.equal(dashboardQuery.data.widgets.length, 2)

    const alert = await call('/api/metrics/alerts', {
      method: 'POST',
      body: JSON.stringify({
        key: `e2e-alert-${suffix}`,
        metricKey,
        operator: 'lt',
        threshold: 10,
        windowMinutes: 60,
        cooldownMinutes: 60,
        channels: ['inbox'],
      }),
    })
    assert.equal(alert.status, 201, JSON.stringify(alert.data))
    const evaluated = await call('/api/metrics/alerts/evaluate', { method: 'POST', body: '{}' })
    assert.equal(evaluated.data.firing, 1)
    const cooling = await call('/api/metrics/alerts/evaluate', { method: 'POST', body: '{}' })
    assert.equal(cooling.data.firing, 0)
    // 调整阈值后触发 resolved
    sql(`UPDATE metric_alerts SET operator='gt', threshold=100 WHERE id='${alert.data.id}'`)
    const resolved = await call('/api/metrics/alerts/evaluate', { method: 'POST', body: '{}' })
    assert.equal(resolved.data.resolved, 1)
    const events = await call('/api/metrics/alerts/events?limit=10')
    assert.ok(events.data.some((event) => event.state === 'firing'))
    assert.ok(events.data.some((event) => event.state === 'resolved'))

    // 异步导出 xlsx
    const exportJob = await call('/api/metrics/export', {
      method: 'POST',
      body: JSON.stringify({ format: 'xlsx', metricKeys: [metricKey], from, to }),
    })
    assert.equal(exportJob.status, 201, JSON.stringify(exportJob.data))
    let job = null
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const result = await call(`/api/jobs/${exportJob.data.jobId}`)
      job = result.data
      if (job.status === 'succeeded') break
      if (['failed', 'dead'].includes(job.status)) throw new Error(JSON.stringify(job))
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    assert.equal(job.status, 'succeeded')
    const file = await fetch(`${API}/api/metrics/export/${exportJob.data.jobId}/download`, { headers })
    assert.equal(file.status, 200)
    assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0, 2).toString(), 'PK')

    // 跨租户
    const cross = await fetch(`${API}/api/metrics/definitions`, {
      headers: { ...headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross tenant ${cross.status}`)

    console.log('✓ 指标定义 → 维度查询/对比 → 快照')
    console.log('✓ 看板 widget → 查询；预警 firing/冷却/resolved')
    console.log('✓ 异步导出 xlsx；跨租户拒绝')
    console.log('metrics e2e passed')
  } finally {
    sql(`DELETE FROM dashboard_widgets WHERE "dashboardId" IN (SELECT id FROM dashboards WHERE key LIKE 'e2e-dashboard-${suffix}%')`)
    sql(`DELETE FROM dashboards WHERE key LIKE 'e2e-dashboard-${suffix}%'`)
    sql(`DELETE FROM metric_alert_events WHERE "alertId" IN (SELECT id FROM metric_alerts WHERE key LIKE 'e2e-alert-${suffix}%')`)
    sql(`DELETE FROM metric_alerts WHERE key LIKE 'e2e-alert-${suffix}%'`)
    sql(`DELETE FROM metric_values WHERE "metricKey"='${metricKey}'`)
    sql(`DELETE FROM metric_definitions WHERE key='${metricKey}'`)
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='${blueprintId}'`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
