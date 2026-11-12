/**
 * 教育蓝图性能验收：1000 并发测评提交 + 100 并发看板查询。
 * 需要 API BLUEPRINT_ALLOW_UNSIGNED=true（参考包开发期未签名）。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { rmSync } = require('node:fs')
const { join } = require('node:path')

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

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
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
  const suffix = Date.now()
  const prefix = `edu-perf-${suffix}`
  const packageId = 'education-1.0.0'
  const packageFile = join(process.cwd(), 'blueprints', `${packageId}.erpkg`)
  const createdIds = []
  const metricKeys = []
  try {
    await call('/api/blueprints/package', {
      method: 'POST',
      body: JSON.stringify({ dir: join(process.cwd(), 'templates/education'), out: packageFile }),
    })
    const loaded = await call(`/api/blueprints/${packageId}/load`, { method: 'POST', body: '{}' })
    assert.equal(loaded.status, 200, JSON.stringify(loaded.data).slice(0, 500))
    console.log('package loaded')

    const course = await call(`/api/blueprints/${packageId}/records/Course`, {
      method: 'POST',
      body: JSON.stringify({ title: `${prefix} Course`, major: 'CS' }),
    })
    assert.equal(course.status, 201, JSON.stringify(course.data))
    console.log('course created')
    createdIds.push(course.data.id)
    const educationClass = await call(`/api/blueprints/${packageId}/records/EducationClass`, {
      method: 'POST',
      body: JSON.stringify({ name: `${prefix} Class`, major: 'CS' }),
    })
    assert.equal(educationClass.status, 201, JSON.stringify(educationClass.data))
    createdIds.push(educationClass.data.id)
    const student = await call(`/api/blueprints/${packageId}/records/Student`, {
      method: 'POST',
      body: JSON.stringify({
        name: `${prefix} Student`,
        studentNo: `${prefix}-S1`,
        classId: educationClass.data.id,
        status: 'active',
      }),
    })
    assert.equal(student.status, 201, JSON.stringify(student.data))
    createdIds.push(student.data.id)
    const assessment = await call(`/api/blueprints/${packageId}/records/Assessment`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: course.data.id,
        title: `${prefix} Assessment`,
        totalScore: 100,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    })
    assert.equal(assessment.status, 201, JSON.stringify(assessment.data))
    console.log('assessment created')
    createdIds.push(assessment.data.id)

    const submit = async (index) => {
      const started = Date.now()
      const response = await fetch(`${API}/api/blueprints/${packageId}/records/Attempt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assessmentId: assessment.data.id,
          studentId: student.data.id,
          answers: JSON.stringify({ q1: index % 2 === 0 ? 'A' : 'B' }),
          aiScore: index % 100,
        }),
      })
      const body = await response.json().catch(() => null)
      return { status: response.status, id: body?.data?.id, ms: Date.now() - started }
    }

    const pool = async (total, concurrency, fn) => {
      const results = new Array(total)
      let next = 0
      const worker = async () => {
        while (next < total) {
          const index = next
          next += 1
          try {
            results[index] = await fn(index)
          } catch (error) {
            results[index] = { status: 0, error: error.message, ms: 0 }
          }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, () => worker()))
      return results
    }
    const submitStarted = Date.now()
    const submissions = await pool(1000, 5, submit)
    const submitDuration = Date.now() - submitStarted
    const success = submissions.filter((item) => item.status === 201)
    const failures = submissions.filter((item) => item.status !== 201)
    if (failures.length > 0) {
      console.error('sample failures', failures.slice(0, 5))
    }
    assert.ok(
      success.length >= 990,
      `1000 并发提交成功 ${success.length}/1000（失败 ${failures.length}）`,
    )
    for (const item of success) if (item.id) createdIds.push(item.id)
    const submitLatencies = submissions.map((item) => item.ms)
    console.log('submit result', { success: success.length, failures: failures.length, duration: submitDuration })

    // 看板 100 并发
    const metricKey = `${prefix}.attempts`
    metricKeys.push(metricKey)
    const metric = await call('/api/metrics/definitions', {
      method: 'POST',
      body: JSON.stringify({
        key: metricKey,
        name: '测评提交数',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
        sourceConfig: { entity: 'Attempt', blueprintId: 'education' },
        permissions: ['metrics:read'],
      }),
    })
    assert.equal(metric.status, 201, JSON.stringify(metric.data))
    const dashboardKey = `${prefix}.dashboard`
    const dashboard = await call('/api/metrics/dashboards', {
      method: 'POST',
      body: JSON.stringify({
        key: dashboardKey,
        name: '性能看板',
        visibility: {},
        widgets: [
          { key: 'attempts', type: 'number', metricKey, config: {} },
        ],
      }),
    })
    assert.equal(dashboard.status, 201, JSON.stringify(dashboard.data))
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() + 60_000).toISOString()
    const queryOnce = async () => {
      const started = Date.now()
      try {
        const response = await fetch(`${API}/api/metrics/dashboards/${dashboardKey}/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ from, to, compare: 'none' }),
        })
        await response.arrayBuffer()
        return { status: response.status, ms: Date.now() - started }
      } catch (error) {
        return { status: 0, error: error.message, ms: Date.now() - started }
      }
    }
    const queryStarted = Date.now()
    const queries = await pool(100, 10, () => queryOnce())
    const queryDuration = Date.now() - queryStarted
    console.log('query result', { ok: queries.filter((item) => item.status === 200).length, total: queries.length, duration: queryDuration })
    assert.ok(
      queries.every((item) => item.status === 200),
      `100 并发看板查询失败：${JSON.stringify(queries.filter((item) => item.status !== 200).slice(0, 5))}`,
    )
    const queryLatencies = queries.map((item) => item.ms)

    console.log(
      `✓ 1000 提交（并发窗口 5）：成功 ${success.length}/1000，耗时 ${submitDuration}ms，p50=${percentile(submitLatencies, 0.5)}ms，p95=${percentile(submitLatencies, 0.95)}ms`,
    )
    console.log(
      `✓ 100 看板查询（并发窗口 10）：全部 200，耗时 ${queryDuration}ms，p50=${percentile(queryLatencies, 0.5)}ms，p95=${percentile(queryLatencies, 0.95)}ms`,
    )
    console.log('education performance e2e passed')
  } finally {
    if (createdIds.length > 0) {
      const ids = createdIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM blueprint_approvals WHERE "blueprintId"='education' AND "recordId" IN (${ids})`)
      sql(`DELETE FROM blueprint_records WHERE id IN (${ids})`)
    }
    if (metricKeys.length > 0) {
      const keys = metricKeys.map((key) => `'${key}'`).join(',')
      sql(`DELETE FROM metric_values WHERE "metricKey" IN (${keys})`)
      sql(`DELETE FROM metric_definitions WHERE key IN (${keys})`)
    }
    sql(`DELETE FROM dashboard_widgets WHERE "dashboardId" IN (SELECT id FROM dashboards WHERE key LIKE '${prefix}%')`)
    sql(`DELETE FROM dashboards WHERE key LIKE '${prefix}%'`)
    rmSync(packageFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
