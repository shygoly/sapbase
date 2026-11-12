/**
 * 教育参考蓝图 e2e：包编译/装载、课程树/班级学生/素材、知识点/学生导入、
 * 教学数据导出、UI/权限声明。
 *
 * 需要 API BLUEPRINT_ALLOW_UNSIGNED=true（参考包开发期未签名）。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { dirname, join } = require('node:path')
const sharp = require('sharp')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'
const STORAGE_ROOT = process.env.ASSET_STORAGE_DIR || join(process.cwd(), 'apps/api/.data/assets')

function sql(statement) {
  return execFileSync('psql', ['-d', DB, '-tAc', statement], { encoding: 'utf8' }).trim()
}

async function login(email = 'admin@example.com', password = '123456') {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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
    const type = response.headers.get('content-type') ?? ''
    if (type.includes('application/json')) {
      const body = await response.json().catch(() => null)
      return { status: response.status, data: body?.data ?? body }
    }
    return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()) }
  }
  const upload = async (path, buffer, filename, extra = {}) => {
    const form = new FormData()
    form.append('file', new Blob([buffer]), filename)
    for (const [key, value] of Object.entries(extra)) form.append(key, String(value))
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'X-Organization-Id': org,
      },
      body: form,
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }
  const waitImport = async (id) => {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      const result = await call(`/api/imports/${id}`)
      if (!['queued', 'running'].includes(result.data?.status)) return result.data
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error('import timeout')
  }
  const waitExport = async (id) => {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      const result = await call(`/api/exports/${id}`)
      if (!['queued', 'running'].includes(result.data?.status)) return result.data
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error('export timeout')
  }

  const suffix = Date.now()
  const prefix = `edu-e2e-${suffix}`
  const packageId = 'education-1.0.0'
  const packageFile = join(process.cwd(), 'blueprints', `${packageId}.erpkg`)
  const importIds = []
  const exportIds = []
  const assetIds = []
  const courseIds = []
  const chapterIds = []
  const classIds = []
  const aiContentIds = []
  const scoreIds = []
  try {
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='education' AND data->>'title' LIKE '${prefix}%'`)
    mkdirSync(join(process.cwd(), 'blueprints'), { recursive: true })
    const packaged = await call('/api/blueprints/package', {
      method: 'POST',
      body: JSON.stringify({ dir: join(process.cwd(), 'templates/education'), out: packageFile }),
    })
    assert.equal(packaged.status, 200, JSON.stringify(packaged.data))
    const loaded = await call(`/api/blueprints/${packageId}/load`, { method: 'POST', body: '{}' })
    assert.equal(loaded.status, 200, JSON.stringify(loaded.data).slice(0, 500))
    assert.ok(loaded.data.compiled?.agents?.items?.length >= 7, 'education agents missing')

    const ui = await call(`/api/blueprints/${packageId}/ui`)
    assert.equal(ui.status, 200, JSON.stringify(ui.data))
    assert.ok(ui.data.pages.length >= 10)
    assert.ok(ui.data.menus.length >= 5)
    const permissions = await call(`/api/blueprints/${packageId}/permissions`)
    assert.equal(permissions.status, 200, JSON.stringify(permissions.data))
    assert.ok(permissions.data.rules.some((rule) => rule.role === 'teacher'))

    // 素材资产
    const image = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#4477aa' },
    })
      .png()
      .toBuffer()
    const init = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: `${prefix}-cover.png`,
        mimeType: 'image/png',
        size: image.length,
      }),
    })
    const objectPath = join(STORAGE_ROOT, init.data.session.objectKey)
    mkdirSync(dirname(objectPath), { recursive: true })
    writeFileSync(objectPath, image)
    const complete = await call(`/api/asset-uploads/${init.data.session.id}/complete`, {
      method: 'POST',
      body: '{}',
    })
    assetIds.push(complete.data.assetId)
    let asset = null
    for (let index = 0; index < 120; index += 1) {
      asset = (await call(`/api/assets/${complete.data.assetId}`)).data
      if (asset.status === 'ready') break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    assert.equal(asset.status, 'ready')

    const course = await call(`/api/blueprints/${packageId}/records/Course`, {
      method: 'POST',
      body: JSON.stringify({ title: `${prefix} Course`, intro: 'intro', major: 'CS', cover: asset.id }),
    })
    assert.equal(course.status, 201, JSON.stringify(course.data))
    courseIds.push(course.data.id)
    const cloned = await call(
      `/api/blueprints/${packageId}/records/Course/${course.data.id}/clone`,
      {
        method: 'POST',
        body: JSON.stringify({
          uniqueStrategy: 'suffix',
          dataOverride: { title: `${prefix} Course Clone` },
        }),
      },
    )
    assert.equal(cloned.status, 201, JSON.stringify(cloned.data))
    assert.notEqual(cloned.data.id, course.data.id)
    courseIds.push(cloned.data.id)
    const snapshot = await call(
      `/api/blueprints/${packageId}/records/Course/${course.data.id}/snapshots`,
      { method: 'POST', body: JSON.stringify({ label: 'v1' }) },
    )
    assert.equal(snapshot.status, 201, JSON.stringify(snapshot.data))

    const chapter = await call(`/api/blueprints/${packageId}/records/Chapter`, {
      method: 'POST',
      body: JSON.stringify({ courseId: course.data.id, title: `${prefix} Chapter`, sortOrder: 1 }),
    })
    assert.equal(chapter.status, 201, JSON.stringify(chapter.data))
    chapterIds.push(chapter.data.id)
    const childChapter = await call(`/api/blueprints/${packageId}/records/Chapter`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: course.data.id,
        parentId: chapter.data.id,
        title: `${prefix} Chapter 1.1`,
        sortOrder: 1,
      }),
    })
    assert.equal(childChapter.status, 201, JSON.stringify(childChapter.data))
    chapterIds.push(childChapter.data.id)
    const knowledge = await call(`/api/blueprints/${packageId}/records/KnowledgePoint`, {
      method: 'POST',
      body: JSON.stringify({
        chapterId: chapter.data.id,
        title: `${prefix} Knowledge`,
        difficulty: 'easy',
        sortOrder: 1,
      }),
    })
    assert.equal(knowledge.status, 201, JSON.stringify(knowledge.data))
    const material = await call(`/api/blueprints/${packageId}/records/Material`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: course.data.id,
        knowledgePointId: knowledge.data.id,
        title: `${prefix} Material`,
        materialKind: 'image',
      }),
    })
    assert.equal(material.status, 201, JSON.stringify(material.data))
    aiContentIds.push(material.data.id)
    const provenance = await call('/api/ai-governance/provenance', {
      method: 'POST',
      body: JSON.stringify({
        contentId: material.data.id,
        contentType: 'asset',
        producer: 'agent',
        content: `${prefix} AI generated material`,
        agent: 'edu-outline',
        model: 'deepseek',
        prompt: '生成课程素材',
        taskId: `${prefix}-task`,
      }),
    })
    assert.equal(provenance.status, 201, JSON.stringify(provenance.data))
    for (const labelType of ['explicit', 'implicit']) {
      const label = await call('/api/ai-governance/labels', {
        method: 'POST',
        body: JSON.stringify({
          contentId: material.data.id,
          labelType,
          text: labelType === 'explicit' ? 'AI 生成' : 'AIGC',
        }),
      })
      assert.equal(label.status, 201, JSON.stringify(label.data))
    }
    const verified = await call('/api/ai-governance/labels/verify', {
      method: 'POST',
      body: JSON.stringify({ contentId: material.data.id, labelType: 'explicit' }),
    })
    assert.equal(verified.status, 200, JSON.stringify(verified.data))
    const review = await call('/api/ai-governance/review/submit', {
      method: 'POST',
      body: JSON.stringify({ contentId: material.data.id, text: `${prefix} AI material` }),
    })
    assert.equal(review.status, 201, JSON.stringify(review.data))
    const gate = await call(`/api/ai-governance/gate/${material.data.id}`)
    assert.equal(gate.status, 200, JSON.stringify(gate.data))
    assert.equal(gate.data.allowed, false)
    assert.match(String(gate.data.reason), /review|label/)

    const educationClass = await call(`/api/blueprints/${packageId}/records/EducationClass`, {
      method: 'POST',
      body: JSON.stringify({ name: `${prefix} Class`, major: 'CS' }),
    })
    assert.equal(educationClass.status, 201, JSON.stringify(educationClass.data))
    classIds.push(educationClass.data.id)
    const student = await call(`/api/blueprints/${packageId}/records/Student`, {
      method: 'POST',
      body: JSON.stringify({
        name: `${prefix} Student`,
        studentNo: `${prefix}-S0`,
        classId: educationClass.data.id,
        status: 'active',
      }),
    })
    assert.equal(student.status, 201, JSON.stringify(student.data))

    // 任务 → 学习 → 测评 → 推荐闭环
    const task = await call(`/api/blueprints/${packageId}/records/TeachingTask`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${prefix} Task`,
        type: 'homework',
        courseId: course.data.id,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    })
    assert.equal(task.status, 201, JSON.stringify(task.data))
    const taskClass = await call(`/api/blueprints/${packageId}/records/TaskClass`, {
      method: 'POST',
      body: JSON.stringify({ taskId: task.data.id, classId: educationClass.data.id }),
    })
    assert.equal(taskClass.status, 201, JSON.stringify(taskClass.data))
    const taskApproval = await call(
      `/api/blueprints/${packageId}/records/TeachingTask/${task.data.id}/approvals/task-publish/approve`,
      { method: 'POST', body: JSON.stringify({ role: 'admin' }) },
    )
    assert.equal(taskApproval.status, 200, JSON.stringify(taskApproval.data))
    const taskTransition = await call(
      `/api/blueprints/${packageId}/records/TeachingTask/${task.data.id}/transition`,
      { method: 'POST', body: JSON.stringify({ to: 'published' }) },
    )
    assert.equal(taskTransition.status, 200, JSON.stringify(taskTransition.data))
    let notified = false
    for (let index = 0; index < 30; index += 1) {
      const inbox = await call('/api/notifications?all=true')
      const list = inbox.data?.notifications ?? inbox.data ?? []
      if (Array.isArray(list) && list.some((item) => item.data?.entity === 'TeachingTask')) {
        notified = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.ok(notified, 'task transition notification missing')
    const learning = await call(`/api/blueprints/${packageId}/records/LearningRecord`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: student.data.id,
        courseId: course.data.id,
        knowledgePointId: knowledge.data.id,
        duration: 120,
        progress: 100,
      }),
    })
    assert.equal(learning.status, 201, JSON.stringify(learning.data))
    const question = await call(`/api/blueprints/${packageId}/records/Question`, {
      method: 'POST',
      body: JSON.stringify({
        knowledgePointId: knowledge.data.id,
        type: 'single',
        difficulty: 'easy',
        stem: `${prefix} Question`,
        options: '["A","B"]',
        answer: 'A',
      }),
    })
    assert.equal(question.status, 201, JSON.stringify(question.data))
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
    await call(`/api/blueprints/${packageId}/records/AssessmentClass`, {
      method: 'POST',
      body: JSON.stringify({ assessmentId: assessment.data.id, classId: educationClass.data.id }),
    })
    await call(`/api/blueprints/${packageId}/records/AssessmentQuestion`, {
      method: 'POST',
      body: JSON.stringify({ assessmentId: assessment.data.id, questionId: question.data.id, score: 10, order: 1 }),
    })
    const attempt = await call(`/api/blueprints/${packageId}/records/Attempt`, {
      method: 'POST',
      body: JSON.stringify({
        assessmentId: assessment.data.id,
        studentId: student.data.id,
        answers: '{"q1":"A"}',
        aiScore: 8,
      }),
    })
    assert.equal(attempt.status, 201, JSON.stringify(attempt.data))
    for (const to of ['submitted', 'aiScored', 'teacherConfirmed', 'final']) {
      const moved = await call(
        `/api/blueprints/${packageId}/records/Attempt/${attempt.data.id}/transition`,
        { method: 'POST', body: JSON.stringify({ to }) },
      )
      assert.equal(moved.status, 200, JSON.stringify(moved.data))
      const after = await call(`/api/blueprints/${packageId}/records/Attempt/${attempt.data.id}`)
      assert.equal(after.data.state, to)
    }
    aiContentIds.push(attempt.data.id)
    const aiScore = await call('/api/ai-governance/scores', {
      method: 'POST',
      body: JSON.stringify({
        contentId: attempt.data.id,
        subjectType: 'attempt',
        subjectId: attempt.data.id,
        aiScore: 8,
        ruleVersion: 'v1',
      }),
    })
    assert.equal(aiScore.status, 201, JSON.stringify(aiScore.data))
    scoreIds.push(aiScore.data.id)
    const confirmedScore = await call(`/api/ai-governance/scores/${aiScore.data.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ humanScore: 9 }),
    })
    assert.equal(confirmedScore.status, 200, JSON.stringify(confirmedScore.data))
    const appealed = await call(`/api/ai-governance/scores/${aiScore.data.id}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'e2e appeal' }),
    })
    assert.equal(appealed.status, 200, JSON.stringify(appealed.data))
    const recommendation = await call(`/api/blueprints/${packageId}/records/Recommendation`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: student.data.id,
        resourceKey: 'Course',
        resourceId: course.data.id,
        reason: '继续学习',
        score: 0.9,
        source: 'rule',
      }),
    })
    assert.equal(recommendation.status, 201, JSON.stringify(recommendation.data))

    // 100 知识点导入：3 行非法
    const knowledgeRows = [['chapterId', 'title', 'difficulty', 'sortOrder']]
    for (let index = 0; index < 100; index += 1) {
      if (index === 9) {
        knowledgeRows.push([chapter.data.id, '', 'easy', String(index)])
      } else if (index === 19) {
        knowledgeRows.push([chapter.data.id, `${prefix}-K${index}`, 'impossible', String(index)])
      } else if (index === 29) {
        knowledgeRows.push(['', `${prefix}-K${index}`, 'easy', String(index)])
      } else {
        knowledgeRows.push([chapter.data.id, `${prefix}-K${index}`, 'easy', String(index)])
      }
    }
    const knowledgeCsv = knowledgeRows
      .map((row) => row.map((value) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : value)).join(','))
      .join('\n')
    const knowledgeImport = await upload('/api/imports', Buffer.from(knowledgeCsv), 'knowledge.csv', {
      resourceKey: `blueprint:${packageId}:KnowledgePoint`,
      mode: 'partial',
    })
    assert.equal(knowledgeImport.status, 201, JSON.stringify(knowledgeImport.data))
    importIds.push(knowledgeImport.data.run.id)
    assert.equal(knowledgeImport.data.run.status, 'partial', JSON.stringify(knowledgeImport.data.run))
    assert.equal(knowledgeImport.data.run.successCount, 97)
    assert.equal(knowledgeImport.data.run.failureCount, 3)
    assert.equal(
      Number(sql(`SELECT count(*) FROM blueprint_records WHERE "blueprintId"='education' AND entity='KnowledgePoint' AND data->>'title' LIKE '${prefix}-K%'`)),
      97,
    )

    // 501 学生导入（异步）
    const studentRows = [['name', 'studentNo', 'classId', 'status']]
    for (let index = 0; index < 501; index += 1) {
      studentRows.push([`${prefix} Student ${index}`, `${prefix}-S${index + 1}`, educationClass.data.id, 'active'])
    }
    const studentCsv = studentRows.map((row) => row.join(',')).join('\n')
    const studentImport = await upload('/api/imports', Buffer.from(studentCsv), 'students.csv', {
      resourceKey: `blueprint:${packageId}:Student`,
    })
    assert.equal(studentImport.status, 201, JSON.stringify(studentImport.data))
    importIds.push(studentImport.data.run.id)
    assert.ok(studentImport.data.jobId, '501 students should be async')
    const studentRun = await waitImport(studentImport.data.run.id)
    assert.equal(studentRun.status, 'succeeded', JSON.stringify(studentRun))
    assert.equal(studentRun.successCount, 501)

    // 教学数据异步导出
    const exported = await call('/api/exports', {
      method: 'POST',
      body: JSON.stringify({
        resourceKey: `blueprint:${packageId}:KnowledgePoint`,
        format: 'xlsx',
        fields: ['title', 'difficulty', 'sortOrder'],
        filter: { difficulty: 'easy' },
      }),
    })
    assert.equal(exported.status, 201, JSON.stringify(exported.data))
    exportIds.push(exported.data.run.id)
    const exportRun = await waitExport(exported.data.run.id)
    assert.equal(exportRun.status, 'succeeded', JSON.stringify(exportRun))
    assert.ok(exportRun.rowCount >= 97)
    const file = await call(`/api/exports/${exportRun.id}/download`)
    assert.equal(file.buffer.subarray(0, 2).toString(), 'PK')

    // 教育核心指标/看板/预警
    const metricPrefix = `education.e2e.${suffix}`
    const metricEntities = [
      ['students', 'Student'],
      ['courses', 'Course'],
      ['knowledge_points', 'KnowledgePoint'],
      ['assessments', 'Assessment'],
      ['learning_records', 'LearningRecord'],
      ['attempts', 'Attempt'],
      ['recommendations', 'Recommendation'],
    ]
    for (const [suffixKey, entity] of metricEntities) {
      const created = await call('/api/metrics/definitions', {
        method: 'POST',
        body: JSON.stringify({
          key: `${metricPrefix}.${suffixKey}`,
          name: `教育 ${entity}`,
          period: 'day',
          aggregation: 'count',
          sourceType: 'blueprint',
          sourceConfig: { entity, blueprintId: 'education' },
          dimensions: [],
          permissions: ['metrics:read'],
        }),
      })
      assert.equal(created.status, 201, JSON.stringify(created.data))
    }
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() + 60_000).toISOString()
    const metricQuery = await call('/api/metrics/query', {
      method: 'POST',
      body: JSON.stringify({ metricKey: `${metricPrefix}.students`, from, to }),
    })
    assert.equal(metricQuery.status, 200, JSON.stringify(metricQuery.data))
    assert.ok(metricQuery.data.items.reduce((sum, item) => sum + item.value, 0) >= 501)
    const dimensionMetric = await call('/api/metrics/definitions', {
      method: 'POST',
      body: JSON.stringify({
        key: `${metricPrefix}.students_by_class`,
        name: '按班级学生数',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
        sourceConfig: { entity: 'Student', blueprintId: 'education' },
        dimensions: ['classId'],
        permissions: ['metrics:read'],
      }),
    })
    assert.equal(dimensionMetric.status, 201, JSON.stringify(dimensionMetric.data))
    const dimensionQuery = await call('/api/metrics/query', {
      method: 'POST',
      body: JSON.stringify({
        metricKey: `${metricPrefix}.students_by_class`,
        from,
        to,
        dimensions: ['classId'],
      }),
    })
    assert.equal(dimensionQuery.status, 200, JSON.stringify(dimensionQuery.data))
    assert.ok(dimensionQuery.data.items.some((item) => item.dimensions.classId))

    const dashboard = await call('/api/metrics/dashboards', {
      method: 'POST',
      body: JSON.stringify({
        key: `${metricPrefix}.dashboard`,
        name: '教育运营看板',
        visibility: {},
        widgets: [
          { key: 'students', type: 'number', metricKey: `${metricPrefix}.students`, config: {} },
          { key: 'courses', type: 'number', metricKey: `${metricPrefix}.courses`, config: {} },
        ],
      }),
    })
    assert.equal(dashboard.status, 201, JSON.stringify(dashboard.data))
    const dashboardQuery = await call(`/api/metrics/dashboards/${metricPrefix}.dashboard/query`, {
      method: 'POST',
      body: JSON.stringify({ from, to, compare: 'none' }),
    })
    assert.equal(dashboardQuery.status, 200, JSON.stringify(dashboardQuery.data))
    assert.equal(dashboardQuery.data.widgets.length, 2)
    for (const role of ['teacher', 'student']) {
      const personal = await call('/api/metrics/dashboards', {
        method: 'POST',
        body: JSON.stringify({
          key: `${metricPrefix}.${role}`,
          name: `${role} 个人看板`,
          visibility: { roles: [role] },
          widgets: [
            { key: 'students', type: 'number', metricKey: `${metricPrefix}.students`, config: {} },
          ],
        }),
      })
      assert.equal(personal.status, 201, JSON.stringify(personal.data))
    }
    const alert = await call('/api/metrics/alerts', {
      method: 'POST',
      body: JSON.stringify({
        key: `${metricPrefix}.alert`,
        metricKey: `${metricPrefix}.students`,
        operator: 'gt',
        threshold: 0,
        windowMinutes: 60,
        cooldownMinutes: 60,
        channels: ['inbox'],
      }),
    })
    assert.equal(alert.status, 201, JSON.stringify(alert.data))
    const evaluated = await call('/api/metrics/alerts/evaluate', { method: 'POST', body: '{}' })
    assert.ok(evaluated.data.firing >= 1)

    // 数据范围负例：Manager 无教育范围策略 → 空/拒绝
    const managerSession = await login('manager@example.com', '123456')
    const managerCall = await fetch(
      `${API}/api/blueprints/${packageId}/records/EducationClass`,
      {
        headers: {
          Authorization: `Bearer ${managerSession.access_token}`,
          'X-Organization-Id': managerSession.currentOrganizationId,
        },
      },
    )
    assert.ok([200, 403, 404].includes(managerCall.status), `manager scope ${managerCall.status}`)
    if (managerCall.status === 200) {
      const body = await managerCall.json()
      assert.equal((body.data ?? body).length, 0)
    }

    // 跨租户负例
    const cross = await call(`/api/blueprints/${packageId}/records/Course/${course.data.id}`, {
      headers: { 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross status ${cross.status}`)

    // 非法包：悬空引用必须编译失败
    const invalidDir = mkdtempSync(join(tmpdir(), 'edu-invalid-'))
    writeFileSync(
      join(invalidDir, 'blueprint.json'),
      JSON.stringify({ blueprint: 'edu-invalid', version: '1.0.0', runtime: '>=1.0.0 <2.0.0', dependencies: [] }),
    )
    writeFileSync(
      join(invalidDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Broken',
            fields: [{ name: 'ref', type: 'reference', reference: 'Missing' }],
            states: [{ name: 'draft', initial: true }, { name: 'done', final: true }],
            transitions: [{ from: 'draft', to: 'done' }],
          },
        ],
      }),
    )
    const invalidFile = join(process.cwd(), 'blueprints', 'edu-invalid-e2e.erpkg')
    await call('/api/blueprints/package', {
      method: 'POST',
      body: JSON.stringify({ dir: invalidDir, out: invalidFile }),
    })
    const invalidCompile = await call('/api/blueprints/edu-invalid-e2e/compile', {
      method: 'POST',
      body: JSON.stringify({ stamp: false }),
    })
    assert.equal(invalidCompile.status, 400, JSON.stringify(invalidCompile.data))
    rmSync(invalidDir, { recursive: true, force: true })
    rmSync(invalidFile, { force: true })

    console.log('✓ 教育包编译/装载；UI/权限声明；课程树/素材/班级/学生')
    console.log('✓ 100 知识点 partial（97/3）；501 学生异步导入；知识点 xlsx 异步导出')
    console.log('✓ 7 个教育指标 / 看板 / 预警')
    console.log('education blueprint e2e passed')
  } finally {
    if (importIds.length > 0) {
      sql(`DELETE FROM import_runs WHERE id IN (${importIds.map((id) => `'${id}'`).join(',')})`)
    }
    if (exportIds.length > 0) {
      sql(`DELETE FROM export_runs WHERE id IN (${exportIds.map((id) => `'${id}'`).join(',')})`)
    }
    if (assetIds.length > 0) {
      sql(`DELETE FROM asset_variants WHERE "assetId" IN (${assetIds.map((id) => `'${id}'`).join(',')})`)
      sql(`DELETE FROM assets WHERE id IN (${assetIds.map((id) => `'${id}'`).join(',')})`)
    }
    sql(`DELETE FROM blueprint_approvals WHERE "blueprintId"='education'`)
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='education' AND (data->>'title' LIKE '${prefix}%' OR data->>'name' LIKE '${prefix}%' OR data->>'studentNo' LIKE '${prefix}%')`)
    sql(`DELETE FROM metric_alert_events WHERE "alertId" IN (SELECT id FROM metric_alerts WHERE key LIKE 'education.e2e.${suffix}%')`)
    sql(`DELETE FROM metric_alerts WHERE key LIKE 'education.e2e.${suffix}%'`)
    sql(`DELETE FROM dashboard_widgets WHERE "dashboardId" IN (SELECT id FROM dashboards WHERE key LIKE 'education.e2e.${suffix}%')`)
    sql(`DELETE FROM dashboards WHERE key LIKE 'education.e2e.${suffix}%'`)
    sql(`DELETE FROM metric_values WHERE "metricKey" LIKE 'education.e2e.${suffix}%'`)
    sql(`DELETE FROM metric_definitions WHERE key LIKE 'education.e2e.${suffix}%'`)
    if (aiContentIds.length > 0) {
      const ids = aiContentIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM ai_content_labels WHERE "contentId" IN (${ids})`)
      sql(`DELETE FROM ai_content_provenance WHERE "contentId" IN (${ids})`)
    }
    if (scoreIds.length > 0) {
      sql(`DELETE FROM ai_score_records WHERE id IN (${scoreIds.map((id) => `'${id}'`).join(',')})`)
    }
    rmSync(packageFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
