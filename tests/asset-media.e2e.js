/**
 * 资产/媒体 e2e：图片 EXIF 剥离 + 缩略图/预览、视频 probe/MP4/HLS/字幕、
 * Range 串流、公开资产、跨租户、过期上传会话清理。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { dirname, join } = require('node:path')
const sharp = require('sharp')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'
const STORAGE_ROOT = process.env.ASSET_STORAGE_DIR || join(process.cwd(), 'apps/api/.data/assets')

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
    return { status: response.status, data: body?.data ?? body, headers: response.headers }
  }
  const waitAsset = async (id) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const result = await call(`/api/assets/${id}`)
      const asset = result.data
      if (asset?.status === 'ready' || asset?.status === 'failed' || asset?.status === 'quarantined') {
        return asset
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error('asset processing timeout')
  }
  const putObject = async (sessionData, body) => {
    const path = join(STORAGE_ROOT, sessionData.objectKey)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, body)
  }

  const suffix = Date.now()
  const imageAssetIds = []
  const sessionIds = []
  const videoDir = join(STORAGE_ROOT, '..', `asset-e2e-${Date.now()}`)
  mkdirSync(videoDir, { recursive: true })
  try {
    // 图片：EXIF 剥离 + thumbnail/preview + crop
    const image = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#2255aa' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'e2e-camera' } } })
      .toBuffer()
    const imageInit = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'e2e-image.jpg',
        mimeType: 'image/jpeg',
        size: image.length,
        metadata: { crop: { left: 10, top: 10, width: 320, height: 180 } },
      }),
    })
    assert.equal(imageInit.status, 201, JSON.stringify(imageInit.data))
    sessionIds.push(imageInit.data.session.id)
    await putObject(imageInit.data.session, image)
    const imageComplete = await call(`/api/asset-uploads/${imageInit.data.session.id}/complete`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(imageComplete.status, 201, JSON.stringify(imageComplete.data))
    imageAssetIds.push(imageComplete.data.assetId)
    const imageAsset = await waitAsset(imageComplete.data.assetId)
    assert.equal(imageAsset.status, 'ready', JSON.stringify(imageAsset))
    assert.equal(imageAsset.kind, 'image')
    assert.equal(imageAsset.width, 1600)
    assert.equal(imageAsset.height, 900)
    assert.equal(imageAsset.scanStatus, 'skipped')
    assert.equal(imageAsset.metadata.exifStripped, true)
    const imageVariants = await call(`/api/assets/${imageAsset.id}/variants`)
    const kinds = imageVariants.data.map((item) => item.kind)
    assert.ok(kinds.includes('thumbnail'))
    assert.ok(kinds.includes('preview'))
    assert.ok(kinds.includes('crop'))
    const crop = imageVariants.data.find((item) => item.kind === 'crop')
    assert.equal(crop.width, 320)
    assert.equal(crop.height, 180)
    const variantUrls = await call(`/api/assets/${imageAsset.id}/variants/urls`)
    assert.ok(variantUrls.data.every((item) => item.url.includes('expires=')))
    const cleaned = await sharp(join(STORAGE_ROOT, imageAsset.objectKey)).metadata()
    assert.equal(cleaned.exif, undefined)

    // Range 串流
    const range = await fetch(`${API}/api/assets/${imageAsset.id}/content`, {
      headers: { ...headers, Range: 'bytes=0-31' },
    })
    assert.equal(range.status, 206)
    assert.match(range.headers.get('content-range') ?? '', /^bytes 0-31\/\d+/)
    assert.equal(Buffer.from(await range.arrayBuffer()).length, 32)

    // 公开资产（无 Authorization）
    sql(`UPDATE assets SET "isPublic"=true WHERE id='${imageAsset.id}'`)
    const publicContent = await fetch(`${API}/api/assets/public/${imageAsset.id}/content`)
    assert.equal(publicContent.status, 200)
    assert.ok((await publicContent.arrayBuffer()).byteLength > 0)
    sql(`UPDATE assets SET "isPublic"=false WHERE id='${imageAsset.id}'`)

    // 视频：probe + mp4 + thumbnail + HLS + subtitle
    const videoPath = join(videoDir, 'source.mp4')
    execFileSync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x180:rate=24',
      '-t',
      '1',
      '-pix_fmt',
      'yuv420p',
      videoPath,
    ])
    const video = require('node:fs').readFileSync(videoPath)
    const videoInit = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'e2e-video.mp4',
        mimeType: 'video/mp4',
        size: video.length,
        metadata: {
          generateHls: true,
          subtitle: 'WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n',
        },
      }),
    })
    assert.equal(videoInit.status, 201, JSON.stringify(videoInit.data))
    sessionIds.push(videoInit.data.session.id)
    await putObject(videoInit.data.session, video)
    const videoComplete = await call(`/api/asset-uploads/${videoInit.data.session.id}/complete`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(videoComplete.status, 201, JSON.stringify(videoComplete.data))
    imageAssetIds.push(videoComplete.data.assetId)
    const videoAsset = await waitAsset(videoComplete.data.assetId)
    assert.equal(videoAsset.status, 'ready', JSON.stringify(videoAsset))
    assert.equal(videoAsset.kind, 'video')
    assert.ok(videoAsset.durationMs >= 900)
    const videoVariants = (await call(`/api/assets/${videoAsset.id}/variants`)).data
    const videoKinds = videoVariants.map((item) => item.kind)
    assert.ok(videoKinds.includes('mp4'), JSON.stringify(videoKinds))
    assert.ok(videoKinds.includes('thumbnail'), JSON.stringify(videoKinds))
    assert.ok(videoKinds.includes('hls'), JSON.stringify(videoKinds))
    assert.ok(videoKinds.includes('subtitle'), JSON.stringify(videoKinds))

    // 跨租户
    const cross = await call(`/api/assets/${imageAsset.id}`, {
      headers: { 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross status ${cross.status}`)

    // 过期上传会话清理
    const expired = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'expired.txt',
        mimeType: 'text/plain',
        size: 4,
      }),
    })
    sessionIds.push(expired.data.session.id)
    sql(`UPDATE asset_upload_sessions SET "expiresAt"=now()-interval '1 hour' WHERE id='${expired.data.session.id}'`)
    const cleanedSessions = await call('/api/asset-uploads/cleanup', { method: 'POST', body: '{}' })
    assert.equal(cleanedSessions.status, 201)
    assert.ok(cleanedSessions.data >= 1)
    const expiredRow = sql(
      `SELECT status FROM asset_upload_sessions WHERE id='${expired.data.session.id}'`,
    )
    assert.equal(expiredRow, 'expired')

    // 校验和不符
    const badChecksumInit = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'bad-checksum.txt',
        mimeType: 'text/plain',
        size: 4,
        checksum: 'sha256:deadbeef',
      }),
    })
    sessionIds.push(badChecksumInit.data.session.id)
    await putObject(badChecksumInit.data.session, Buffer.from('test'))
    const badChecksum = await call(`/api/asset-uploads/${badChecksumInit.data.session.id}/complete`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(badChecksum.status, 400, JSON.stringify(badChecksum.data))

    // 伪造分片（不连续/总大小不符）
    const forgedInit = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'forged.txt',
        mimeType: 'text/plain',
        size: 10,
      }),
    })
    sessionIds.push(forgedInit.data.session.id)
    await putObject(forgedInit.data.session, Buffer.from('0123456789'))
    await call(`/api/asset-uploads/${forgedInit.data.session.id}/parts`, {
      method: 'POST',
      body: JSON.stringify({ partNumber: 2, etag: 'x', size: 10 }),
    })
    const forged = await call(`/api/asset-uploads/${forgedInit.data.session.id}/complete`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(forged.status, 400, JSON.stringify(forged.data))

    // 管理员配额调整：临时 1 byte → 上传拒绝，再恢复
    await call('/api/assets/quota', {
      method: 'PATCH',
      body: JSON.stringify({ limitBytes: 1 }),
    })
    const quotaDenied = await call('/api/asset-uploads', {
      method: 'POST',
      body: JSON.stringify({
        originalName: 'quota.txt',
        mimeType: 'text/plain',
        size: 4,
      }),
    })
    assert.equal(quotaDenied.status, 403, JSON.stringify(quotaDenied.data))
    await call('/api/assets/quota', {
      method: 'PATCH',
      body: JSON.stringify({ limitBytes: 5 * 1024 * 1024 * 1024 }),
    })

    // 保留期：被业务记录引用 → 顺延；解除引用 → 删除
    const retentionAsset = randomUUID()
    const retentionKey = `org/${org}/retention-${suffix}.txt`
    writeFileSync(join(STORAGE_ROOT, retentionKey), Buffer.from('retention'))
    sql(
      `INSERT INTO assets (id,"createdAt","updatedAt","organizationId",kind,status,"scanStatus",provider,"objectKey","originalName","mimeType",size,"isPublic","retentionUntil")
       VALUES ('${retentionAsset}',now(),now(),'${org}','document','ready','clean','local','${retentionKey}','r.txt','text/plain',9,false,now()-interval '1 day')`,
    )
    imageAssetIds.push(retentionAsset)
    sql(
      `INSERT INTO blueprint_records (id,"createdAt","updatedAt","organizationId","blueprintId","blueprintVersion",entity,data,state,version)
       VALUES (uuid_generate_v4(),now(),now(),'${org}','e2e-retention','1.0.0','RetentionProbe','{"assetId":"${retentionAsset}"}'::jsonb,'active',1)`,
    )
    const deferred = await call('/api/assets/cleanup', { method: 'POST', body: '{}' })
    assert.ok(deferred.data.deferred >= 1)
    assert.equal(
      sql(`SELECT status FROM assets WHERE id='${retentionAsset}'`),
      'ready',
    )
    sql(`DELETE FROM blueprint_records WHERE "blueprintId"='e2e-retention'`)
    sql(`UPDATE assets SET "retentionUntil"=now()-interval '1 day' WHERE id='${retentionAsset}'`)
    const deleted = await call('/api/assets/cleanup', { method: 'POST', body: '{}' })
    assert.ok(deleted.data.deleted >= 1)
    assert.equal(
      sql(`SELECT status FROM assets WHERE id='${retentionAsset}'`),
      'deleted',
    )

    // 过期签名 URL
    const signed = await call(`/api/assets/${imageAsset.id}/download`)
    const expiredUrl = signed.data.url.replace(/expires=\d+/, 'expires=1')
    const expiredResponse = await fetch(`${API}${expiredUrl}`)
    assert.equal(expiredResponse.status, 403)

    // 用量
    const usage = await call('/api/assets/usage')
    assert.equal(usage.status, 200)
    assert.ok(usage.data.usedBytes > 0)
    assert.ok(usage.data.limitBytes > 0)

    console.log('✓ 图片 EXIF 剥离 / thumbnail / preview / crop')
    console.log('✓ 视频 probe / MP4 / HLS / 字幕；Range 206；公开资产')
    console.log('✓ 跨租户拒绝；过期上传会话清理；用量查询')
    console.log('asset media e2e passed')
  } finally {
    if (imageAssetIds.length > 0) {
      const ids = imageAssetIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM asset_variants WHERE "assetId" IN (${ids})`)
      sql(`DELETE FROM assets WHERE id IN (${ids})`)
    }
    if (sessionIds.length > 0) {
      sql(`DELETE FROM asset_upload_sessions WHERE id IN (${sessionIds.map((id) => `'${id}'`).join(',')})`)
    }
    rmSync(videoDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
