/**
 * 批量导入/导出 e2e：资源/模板 → 100 行部分成功 → atomic/dry-run → 501 行异步 →
 * 多格式异步导出/签名下载/公式注入 → 字段权限/跨租户/恶意 xlsx。
 *
 * 需要 API 以 JOBS_WORKER_ENABLED=true 运行。清理只删除本次前缀/运行 ID。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const AdmZip = require('adm-zip')
const { createHash, randomUUID } = require('node:crypto')
const { mkdirSync, rmSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')
const STORAGE_ROOT = join(process.cwd(), 'apps/api/.data/assets')

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

function xlsx(rows) {
  const zip = new AdmZip()
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    ),
  )
  zip.addFile('xl/workbook.xml', Buffer.from('<workbook><sheets><sheet name="S" sheetId="1"/></sheets></workbook>'))
  const sheet = rows
    .map(
      (cells, rowIndex) =>
        `<row r="${rowIndex + 1}">${cells
          .map(
            (cell, cellIndex) =>
              `<c r="${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${cell}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('')
  zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`))
  return zip.toBuffer()
}

function maliciousXlsx() {
  const zip = new AdmZip()
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>',
    ),
  )
  zip.addFile('xl/workbook.xml', Buffer.from('<workbook/>'))
  zip.addFile('xl/vbaProject.bin', Buffer.from('macro'))
  return zip.toBuffer()
}

function csv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? '')
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\n')
}

async function main() {
  const session = await login()
  assert.ok(session?.access_token, 'login failed')
  const org = session.currentOrganizationId
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org,
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => null)
      return { status: response.status, data: body?.data ?? body, headers: response.headers }
    }
    return {
      status: response.status,
      buffer: Buffer.from(await response.arrayBuffer()),
      headers: response.headers,
    }
  }
  const upload = async (path, buffer, filename, extra = {}, headersOverride = {}) => {
    const form = new FormData()
    form.append('file', new Blob([buffer]), filename)
    for (const [key, value] of Object.entries(extra)) form.append(key, String(value))
    return call(path, { method: 'POST', body: form, headers: headersOverride })
  }
  const waitJob = async (jobId) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const result = await call(`/api/jobs/${jobId}`)
      if (result.data?.status === 'succeeded') return result.data
      if (['failed', 'dead'].includes(result.data?.status)) {
        throw new Error(`job ${result.data.status}: ${JSON.stringify(result.data.error)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    throw new Error('job timeout')
  }
  const waitImport = async (id) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const result = await call(`/api/imports/${id}`)
      if (!['queued', 'running'].includes(result.data?.status)) return result.data
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    throw new Error('import timeout')
  }
  const waitExport = async (id) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const result = await call(`/api/exports/${id}`)
      if (!['queued', 'running'].includes(result.data?.status)) return result.data
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    throw new Error('export timeout')
  }

  const suffix = Date.now()
  const prefix = `e2e-bulk-${suffix}`
  const importIds = []
  const exportIds = []
  let packageId = null
  let packageFile = null
  try {
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='e2e-knowledge'`)
    // Blueprint 知识点/学生：真实包（需要 BLUEPRINT_ALLOW_UNSIGNED=true；否则跳过）
    const fixtureDir = join(process.cwd(), 'tests/fixtures/e2e-knowledge')
    packageId = `bulk-knowledge-${suffix}`
    packageFile = join(process.cwd(), 'blueprints', `${packageId}.erpkg`)
    mkdirSync(join(process.cwd(), 'blueprints'), { recursive: true })
    const packaged = await call('/api/blueprints/package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: fixtureDir, out: packageFile }),
    })
    assert.equal(packaged.status, 200, JSON.stringify(packaged.data))
    const knowledgeKey = `blueprint:${packageId}:Knowledge`
    const knowledgeResource = await call(
      `/api/imports/resource?resourceKey=${encodeURIComponent(knowledgeKey)}&direction=import`,
    )
    const blueprintEnabled = knowledgeResource.status === 200
    if (blueprintEnabled) {
      const knowledgeRows = [['knowledgeKey', 'title', 'body', 'difficulty']]
      for (let index = 0; index < 100; index += 1) {
        if (index === 10) {
          knowledgeRows.push([`K${index}`, '', `body-${index}`, 'easy'])
        } else if (index === 20) {
          knowledgeRows.push([`K${index}`, `title-${index}`, `body-${index}`, 'impossible'])
        } else if (index === 30) {
          knowledgeRows.push(['', `title-${index}`, `body-${index}`, 'easy'])
        } else {
          knowledgeRows.push([`K${index}`, `title-${index}`, `body-${index}`, 'easy'])
        }
      }
      const knowledgeImport = await upload('/api/imports', csv(knowledgeRows), 'knowledge.csv', {
        resourceKey: knowledgeKey,
        mode: 'partial',
      })
      assert.equal(knowledgeImport.status, 201, JSON.stringify(knowledgeImport.data))
      importIds.push(knowledgeImport.data.run.id)
      assert.equal(knowledgeImport.data.run.status, 'partial', JSON.stringify(knowledgeImport.data.run))
      assert.equal(knowledgeImport.data.run.successCount, 97)
      assert.equal(knowledgeImport.data.run.failureCount, 3)
      assert.equal(
        Number(sql(`SELECT count(*) FROM blueprint_records WHERE "blueprintId"='e2e-knowledge' AND entity='Knowledge'`)),
        97,
      )

      const studentRows = [['studentNo', 'name', 'className']]
      for (let index = 0; index < 501; index += 1) {
        studentRows.push([`S${index}`, `student-${index}`, 'Class-1'])
      }
      const studentImport = await upload('/api/imports', csv(studentRows), 'students.csv', {
        resourceKey: `blueprint:${packageId}:Student`,
      })
      assert.equal(studentImport.status, 201, JSON.stringify(studentImport.data))
      importIds.push(studentImport.data.run.id)
      assert.ok(studentImport.data.jobId, '501 students should be async')
      await waitJob(studentImport.data.jobId)
      const studentRun = await waitImport(studentImport.data.run.id)
      assert.equal(studentRun.status, 'succeeded')
      assert.equal(studentRun.successCount, 501)

      // 1 万行级异步导出（直接造数，验证分页/流式路径）
      sql(
        `INSERT INTO blueprint_records (id,"createdAt","updatedAt","organizationId","blueprintId","blueprintVersion",entity,data,state,version)
         SELECT uuid_generate_v4(),now(),now(),'${org}','e2e-knowledge','1.0.0','Knowledge',
           jsonb_build_object('knowledgeKey','BULK'||g,'title','bulk-'||g,'difficulty','easy'),'draft',1
         FROM generate_series(1,10000) g`,
      )
      const knowledgeExport = await call('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceKey: knowledgeKey,
          format: 'xlsx',
          fields: ['knowledgeKey', 'title', 'difficulty'],
          filter: { difficulty: 'easy' },
        }),
      })
      assert.equal(knowledgeExport.status, 201, JSON.stringify(knowledgeExport.data))
      exportIds.push(knowledgeExport.data.run.id)
      const knowledgeRun = await waitExport(knowledgeExport.data.run.id)
      assert.equal(knowledgeRun.status, 'succeeded', JSON.stringify(knowledgeRun))
      assert.equal(knowledgeRun.rowCount, 10097)
      const knowledgeFile = await call(`/api/exports/${knowledgeRun.id}/download`)
      assert.equal(knowledgeFile.buffer.subarray(0, 2).toString(), 'PK')
    } else {
      console.log('… 跳过 Blueprint 适配器 e2e（当前 API 未开启未签名蓝图豁免）')
    }

    const resources = await call('/api/imports/resources')
    assert.equal(resources.status, 200)
    assert.ok(resources.data.some((item) => item.resourceKey === 'platform:departments'))
    assert.ok(resources.data.some((item) => item.resourceKey === 'platform:users'))

    const template = await call('/api/imports/template?resourceKey=platform:departments&format=xlsx')
    assert.equal(template.status, 200)
    assert.equal(template.buffer.subarray(0, 2).toString(), 'PK')
    const templateCsv = await call('/api/imports/template?resourceKey=platform:departments&format=csv')
    assert.match(templateCsv.buffer.toString('utf8'), /name\*/)

    // assetId 路径：先上传为资产，再创建导入
    const assetId = randomUUID()
    const objectKey = `org/${org}/bulk-e2e-${suffix}.csv`
    const assetCsv = csv([['name'], [`${prefix}-asset`]])
    const assetPath = join(STORAGE_ROOT, objectKey)
    mkdirSync(dirname(assetPath), { recursive: true })
    writeFileSync(assetPath, assetCsv)
    sql(
      `INSERT INTO assets (id,"createdAt","updatedAt","organizationId",kind,status,"objectKey","originalName","mimeType",size,checksum,"isPublic","deletedAt")
       VALUES ('${assetId}',now(),now(),'${org}','document','ready','${objectKey}','asset.csv','text/csv',${Buffer.byteLength(assetCsv)},'sha256:${createHash('sha256').update(assetCsv).digest('hex')}',false,NULL)`,
    )
    const assetImport = await call('/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, resourceKey: 'platform:departments' }),
    })
    assert.equal(assetImport.status, 201, JSON.stringify(assetImport.data))
    importIds.push(assetImport.data.run.id)
    assert.equal(assetImport.data.run.status, 'succeeded')
    assert.equal(assetImport.data.run.successCount, 1)

    // XLSX 导入
    const xlsxRows = [['name*', 'description'], [`${prefix}-x1`, 'xlsx'], [`${prefix}-x2`, 'xlsx']]
    const xlsxImport = await upload('/api/imports', xlsx(xlsxRows), 'departments.xlsx', {
      resourceKey: 'platform:departments',
    })
    assert.equal(xlsxImport.status, 201, JSON.stringify(xlsxImport.data))
    importIds.push(xlsxImport.data.run.id)
    assert.equal(xlsxImport.data.run.status, 'succeeded')

    // 100 行 partial：3 行非法（缺失必填/非法枚举/悬空引用）
    const rows = [['name', 'description', 'status', 'managerId']]
    for (let index = 0; index < 100; index += 1) {
      const managerId =
        index === 29 ? '11111111-1111-4111-8111-111111111111' : ''
      if (index === 9) {
        rows.push(['', `missing-${index}`, 'active', managerId])
      } else if (index === 19) {
        rows.push([`${prefix}-p${index}`, `bad-status-${index}`, 'broken', managerId])
      } else {
        rows.push([`${prefix}-p${index}`, `row-${index}`, 'active', managerId])
      }
    }
    const partial = await upload('/api/imports', csv(rows), 'partial.csv', {
      resourceKey: 'platform:departments',
      mode: 'partial',
    })
    assert.equal(partial.status, 201, JSON.stringify(partial.data))
    importIds.push(partial.data.run.id)
    assert.equal(partial.data.run.status, 'partial', JSON.stringify(partial.data.run))
    assert.equal(partial.data.run.rowCount, 100)
    assert.equal(partial.data.run.successCount, 97)
    assert.equal(partial.data.run.failureCount, 3)
    assert.ok(partial.data.run.errors.some((error) => error.reason === 'required'))
    assert.ok(partial.data.run.errors.some((error) => error.reason === 'dangling-reference'))
    const errorsCsv = await call(`/api/imports/${partial.data.run.id}/errors`)
    assert.equal(errorsCsv.status, 200)
    assert.match(errorsCsv.buffer.toString('utf8'), /reason/)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name LIKE '${prefix}-p%'`)),
      97,
    )

    // atomic：一行非法整批回滚
    const atomic = await upload(
      '/api/imports',
      csv([
        ['name', 'status'],
        [`${prefix}-a1`, 'active'],
        [`${prefix}-a2`, 'broken'],
        [`${prefix}-a3`, 'active'],
      ]),
      'atomic.csv',
      { resourceKey: 'platform:departments', mode: 'atomic' },
    )
    assert.equal(atomic.status, 201, JSON.stringify(atomic.data))
    importIds.push(atomic.data.run.id)
    assert.equal(atomic.data.run.status, 'failed')
    assert.equal(atomic.data.run.successCount, 0)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name IN ('${prefix}-a1','${prefix}-a2','${prefix}-a3')`)),
      0,
    )
    const retried = await call(`/api/imports/${atomic.data.run.id}/retry`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(retried.status, 200, JSON.stringify(retried.data))
    assert.ok(retried.data.jobId)
    const retriedRun = await waitImport(atomic.data.run.id)
    assert.equal(retriedRun.status, 'failed')

    // dry-run 不落库
    const dryRun = await upload(
      '/api/imports',
      csv([
        ['name'],
        [`${prefix}-d1`],
        [`${prefix}-d2`],
      ]),
      'dry.csv',
      { resourceKey: 'platform:departments', dryRun: 'true' },
    )
    assert.equal(dryRun.status, 201, JSON.stringify(dryRun.data))
    importIds.push(dryRun.data.run.id)
    assert.equal(dryRun.data.run.status, 'succeeded')
    assert.equal(dryRun.data.run.successCount, 2)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name LIKE '${prefix}-d%'`)),
      0,
    )

    // 501 行异步导入
    const asyncRows = [['name', 'description']]
    for (let index = 0; index < 501; index += 1) {
      asyncRows.push([`${prefix}-s${index}`, `async-${index}`])
    }
    const asyncImport = await upload('/api/imports', csv(asyncRows), 'async.csv', {
      resourceKey: 'platform:departments',
    })
    assert.equal(asyncImport.status, 201, JSON.stringify(asyncImport.data))
    importIds.push(asyncImport.data.run.id)
    assert.ok(asyncImport.data.jobId, 'large import should be async')
    const asyncJob = await waitJob(asyncImport.data.jobId)
    assert.equal(asyncJob.status, 'succeeded')
    const asyncRun = await waitImport(asyncImport.data.run.id)
    assert.equal(asyncRun.status, 'succeeded')
    assert.equal(asyncRun.successCount, 501)

    // 幂等键：重复提交同一运行
    const idemKey = `idem-${suffix}`
    const idemBody = csv([
      ['name'],
      [`${prefix}-idem`],
    ])
    const first = await upload('/api/imports', idemBody, 'idem.csv', { resourceKey: 'platform:departments' }, {
      'Idempotency-Key': idemKey,
    })
    importIds.push(first.data.run.id)
    const second = await upload('/api/imports', idemBody, 'idem.csv', { resourceKey: 'platform:departments' }, {
      'Idempotency-Key': idemKey,
    })
    assert.equal(second.data.run.id, first.data.run.id)
    assert.equal(second.data.reused, true)
    assert.equal(
      Number(sql(`SELECT count(*) FROM departments WHERE "organizationId"='${org}' AND name='${prefix}-idem'`)),
      1,
    )

    // 保存列映射
    const mappingName = `map-${suffix}`
    const savedMapping = await call('/api/import-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceKey: 'platform:departments',
        name: mappingName,
        mapping: { 名称: 'name', 描述: 'description' },
      }),
    })
    assert.equal(savedMapping.status, 201, JSON.stringify(savedMapping.data))
    const mappingList = await call('/api/import-mappings?resourceKey=platform:departments')
    assert.ok(mappingList.data.some((item) => item.name === mappingName))
    const removedMapping = await call(`/api/import-mappings/${savedMapping.data.id}`, {
      method: 'DELETE',
    })
    assert.equal(removedMapping.status, 204)

    // 恶意 xlsx 拒绝
    const evil = await upload('/api/imports', maliciousXlsx(), 'evil.xlsx', {
      resourceKey: 'platform:departments',
    })
    assert.equal(evil.status, 400, JSON.stringify(evil.data))

    // 未知资源拒绝
    const unknown = await upload('/api/imports', Buffer.from('name\nx\n'), 'x.csv', {
      resourceKey: 'nope:things',
    })
    assert.equal(unknown.status, 400, JSON.stringify(unknown.data))

    // 公式注入样本 + 多格式导出
    sql(
      `INSERT INTO departments (id,"createdAt","updatedAt","organizationId",name,description,status) VALUES (uuid_generate_v4(),now(),now(),'${org}','=cmd|calc','formula','active')`,
    )
    const largeExport = await call('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceKey: 'platform:departments',
        format: 'csv',
        fields: ['name', 'status', 'description'],
        search: prefix,
      }),
    })
    assert.equal(largeExport.status, 201, JSON.stringify(largeExport.data))
    exportIds.push(largeExport.data.run.id)
    const largeRun = await waitExport(largeExport.data.run.id)
    assert.equal(largeRun.status, 'succeeded', JSON.stringify(largeRun))
    assert.ok(largeRun.rowCount >= 600, `rows=${largeRun.rowCount}`)
    const largeFile = await call(`/api/exports/${largeRun.id}/download`)
    assert.equal(largeFile.status, 200)
    assert.match(largeFile.buffer.toString('utf8'), /name,status,description/)

    for (const format of ['xlsx', 'pdf', 'md']) {
      const created = await call('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceKey: 'platform:departments',
          format,
          fields: ['name'],
          search: '=cmd|calc',
        }),
      })
      assert.equal(created.status, 201, JSON.stringify(created.data))
      exportIds.push(created.data.run.id)
      const run = await waitExport(created.data.run.id)
      assert.equal(run.status, 'succeeded', JSON.stringify(run))
      const file = await call(`/api/exports/${run.id}/download`)
      assert.equal(file.status, 200)
      if (format === 'xlsx') assert.equal(file.buffer.subarray(0, 2).toString(), 'PK')
      if (format === 'pdf') assert.equal(file.buffer.subarray(0, 4).toString(), '%PDF')
      if (format === 'md') assert.match(file.buffer.toString('utf8'), /\| 名称 \|/)
      if (format === 'csv') assert.match(file.buffer.toString('utf8'), /'=cmd\|calc/)
    }
    const formulaCsv = await call('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceKey: 'platform:departments',
        format: 'csv',
        fields: ['name'],
        search: '=cmd|calc',
      }),
    })
    exportIds.push(formulaCsv.data.run.id)
    const formulaRun = await waitExport(formulaCsv.data.run.id)
    const formulaFile = await call(`/api/exports/${formulaRun.id}/download`)
    assert.match(formulaFile.buffer.toString('utf8'), /'=cmd\|calc/)

    const signed = await call(`/api/exports/${largeRun.id}/url?ttl=60`)
    assert.equal(signed.status, 200)
    assert.match(signed.data.url, /expires=/)

    // PII 脱敏
    const masked = await call('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceKey: 'platform:users',
        format: 'csv',
        fields: ['email'],
        piiPolicy: 'mask',
      }),
    })
    assert.equal(masked.status, 201, JSON.stringify(masked.data))
    exportIds.push(masked.data.run.id)
    const maskedRun = await waitExport(masked.data.run.id)
    assert.equal(maskedRun.status, 'succeeded')
    const maskedFile = await call(`/api/exports/${maskedRun.id}/download`)
    assert.match(maskedFile.buffer.toString('utf8'), /\*\*\*@/)

    const exportHistory = await call('/api/exports?limit=10')
    assert.equal(exportHistory.status, 200)
    assert.ok(exportHistory.data.some((run) => run.id === largeRun.id))

    // 字段权限：密码禁止导出
    const denied = await call('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceKey: 'platform:users',
        format: 'csv',
        fields: ['password'],
        restrictedFieldPolicy: 'reject',
      }),
    })
    assert.equal(denied.status, 403, JSON.stringify(denied.data))

    // 跨租户访问导出结果
    const cross = await call(`/api/exports/${largeRun.id}`, {
      headers: { 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross status ${cross.status}`)

    console.log('✓ 资源/模板；XLSX 导入；100 行 partial（97 成功/3 失败，错误报告）')
    console.log('✓ atomic 全回滚；dry-run 不落库；501 行异步导入；幂等键复用')
    console.log('✓ 恶意 xlsx/未知资源拒绝；万行级查询导出；CSV 公式注入转义')
    console.log('✓ XLSX/PDF/MD 导出；签名 URL；字段权限 403；跨租户拒绝')
    console.log('bulk import/export e2e passed')
  } finally {
    if (importIds.length > 0) {
      sql(`DELETE FROM import_runs WHERE id IN (${importIds.map((id) => `'${id}'`).join(',')})`)
    }
    if (exportIds.length > 0) {
      const ids = exportIds.map((id) => `'${id}'`).join(',')
      sql(
        `DELETE FROM assets WHERE metadata->>'exportRunId' IN (SELECT id::text FROM export_runs WHERE id IN (${ids}))`,
      )
      sql(`DELETE FROM export_runs WHERE id IN (${ids})`)
    }
    sql(`DELETE FROM departments WHERE "organizationId"='${org}' AND (name LIKE '${prefix}%' OR name='=cmd|calc')`)
    sql(`DELETE FROM assets WHERE "objectKey" LIKE 'org/${org}/bulk-e2e-%'`)
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='e2e-knowledge'`)
    if (packageFile) rmSync(packageFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
