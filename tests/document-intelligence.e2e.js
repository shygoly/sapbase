/**
 * 文档智能 e2e：PPTX 解析 → 章节/知识点候选 → 确认 → 转换课程实体 → 幂等/冲突。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { createHash, randomUUID } = require('node:crypto')
const { mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { dirname, join } = require('node:path')
const AdmZip = require('adm-zip')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'
const STORAGE_ROOT = join(process.cwd(), 'apps/api/.data/assets')

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

function makePptx() {
  const zip = new AdmZip()
  const slides = [
    '# 第一章 光合作用\n知识点：光合作用需要光照\n概念：叶绿体',
    '# 第二章 细胞呼吸\n知识点：细胞呼吸释放能量',
  ]
  slides.forEach((text, index) => {
    zip.addFile(
      `ppt/slides/slide${index + 1}.xml`,
      Buffer.from(`<p:sld><p:cSld><p:spTree><a:t>${text.replace(/\n/g, '</a:t><a:t>')}</a:t></p:spTree></p:cSld></p:sld>`),
    )
  })
  return zip.toBuffer()
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

  const assetId = randomUUID()
  const objectKey = `org/${org}/e2e-doc-${Date.now()}.pptx`
  const pptx = makePptx()
  const filePath = join(STORAGE_ROOT, objectKey)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, pptx)
  const packageId = `doc-e2e-${Date.now()}`

  try {
    sql(
      `INSERT INTO assets (id,"createdAt","updatedAt","organizationId",kind,status,"objectKey","originalName","mimeType",size,checksum,"isPublic","deletedAt")
       VALUES ('${assetId}',now(),now(),'${org}','document','ready','${objectKey}','e2e.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',${pptx.length},'sha256:${createHash('sha256').update(pptx).digest('hex')}',false,NULL)`,
    )

    const created = await call('/api/document-intelligence/runs', {
      method: 'POST',
      body: JSON.stringify({ assetId }),
    })
    assert.equal(created.status, 201, JSON.stringify(created.data))
    const runId = created.data.run.id
    let job = null
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      job = (await call(`/api/jobs/${created.data.jobId}`)).data
      if (job.status === 'succeeded') break
      if (['failed', 'dead'].includes(job.status)) {
        throw new Error(`parse job ${job.status}: ${JSON.stringify(job.error)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    assert.equal(job.status, 'succeeded')

    const draft = await call(`/api/document-intelligence/runs/${runId}`)
    assert.equal(draft.status, 200, JSON.stringify(draft.data))
    assert.equal(draft.data.run.status, 'succeeded')
    assert.ok(draft.data.sections.length >= 2)
    assert.ok(draft.data.candidates.length >= 2)
    for (const candidate of draft.data.candidates) {
      assert.ok(candidate.anchor.page >= 1)
    }

    const confirmedCandidates = await call(`/api/document-intelligence/runs/${runId}/candidates/confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    assert.ok(confirmedCandidates.data.accepted >= 2)
    const confirmedRun = await call(`/api/document-intelligence/runs/${runId}/confirm`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(confirmedRun.data.confirmedVersion, confirmedRun.data.draftVersion)

    const converted = await call(`/api/document-intelligence/runs/${runId}/convert`, {
      method: 'POST',
      body: JSON.stringify({
        targetResourceKey: 'course',
        packageId,
        entity: 'CourseSection',
      }),
    })
    assert.equal(converted.status, 201, JSON.stringify(converted.data))
    assert.ok(converted.data.converted.length >= 2)
    const rows = sql(`SELECT count(*) FROM blueprint_records WHERE "blueprintId"='${packageId}'`)
    assert.ok(Number(rows) >= 2)

    // 重复转换幂等：不新增实体
    const again = await call(`/api/document-intelligence/runs/${runId}/convert`, {
      method: 'POST',
      body: JSON.stringify({ targetResourceKey: 'course', packageId, entity: 'CourseSection' }),
    })
    assert.equal(again.data.converted.length, converted.data.converted.length)
    const rowsAgain = sql(`SELECT count(*) FROM blueprint_records WHERE "blueprintId"='${packageId}'`)
    assert.equal(Number(rowsAgain), Number(rows))

    // 已转换到其他资源 → 冲突
    const conflict = await call(`/api/document-intelligence/runs/${runId}/convert`, {
      method: 'POST',
      body: JSON.stringify({ targetResourceKey: 'knowledge' }),
    })
    assert.equal(conflict.status, 409, JSON.stringify(conflict.data))

    // 跨租户
    const cross = await fetch(`${API}/api/document-intelligence/runs`, {
      headers: { ...headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross tenant ${cross.status}`)

    console.log('✓ PPTX → 章节/知识点候选（锚点）→ 批量确认')
    console.log('✓ 确认 draftVersion → 转换课程实体 → 幂等/冲突/跨租户')
    console.log('document intelligence e2e passed')
  } finally {
    sql(`DELETE FROM document_candidates WHERE "runId" IN (SELECT id FROM document_parse_runs WHERE "assetId"='${assetId}')`)
    sql(`DELETE FROM document_sections WHERE "runId" IN (SELECT id FROM document_parse_runs WHERE "assetId"='${assetId}')`)
    sql(`DELETE FROM document_parse_runs WHERE "assetId"='${assetId}'`)
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='${packageId}'`)
    sql(`DELETE FROM assets WHERE id='${assetId}'`)
    rmSync(filePath, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
