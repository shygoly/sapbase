/**
 * 离线包 e2e：签名 manifest → 设备/授权 → 下载令牌 → 撤销/过期清理 → 跨租户。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { createHash, randomUUID, verify } = require('node:crypto')
const { mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { dirname, join } = require('node:path')

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
  const objectKey = `org/${org}/offline-e2e-${Date.now()}.txt`
  const content = Buffer.from('offline video placeholder')
  const checksum = createHash('sha256').update(content).digest('hex')
  const filePath = join(STORAGE_ROOT, objectKey)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
  const deviceId = `e2e-device-${Date.now()}`

  try {
    sql(
      `INSERT INTO assets (id,"createdAt","updatedAt","organizationId",kind,status,"objectKey","originalName","mimeType",size,checksum,"isPublic","deletedAt")
       VALUES ('${assetId}',now(),now(),'${org}','video','ready','${objectKey}','offline.txt','text/plain',${content.length},'sha256:${checksum}',false,NULL)`,
    )

    const pkg = await call('/api/offline/packages', {
      method: 'POST',
      body: JSON.stringify({
        key: `course-${Date.now()}`,
        title: 'E2E 离线课程',
        publish: true,
        assets: [{ assetId }],
      }),
    })
    assert.equal(pkg.status, 201, JSON.stringify(pkg.data))
    assert.ok(pkg.data.signature)
    assert.match(pkg.data.manifest.contentHash, /^[a-f0-9]{64}$/)

    await call('/api/offline/devices', {
      method: 'POST',
      body: JSON.stringify({ deviceId, name: 'e2e' }),
    })
    const grant = await call(`/api/offline/packages/${pkg.data.id}/entitlements`, {
      method: 'POST',
      body: JSON.stringify({ userId: session.user.id, deviceId }),
    })
    assert.equal(grant.status, 201, JSON.stringify(grant.data))

    const manifest = await call(
      `/api/offline/packages/${pkg.data.id}/manifest?deviceId=${encodeURIComponent(deviceId)}`,
    )
    assert.equal(manifest.status, 200, JSON.stringify(manifest.data))
    const item = manifest.data.manifest.items[0]
    assert.ok(item.downloadUrl.includes('/api/offline/download/'))

    const download = await fetch(`${API}${item.downloadUrl}`, { headers })
    assert.equal(download.status, 200)
    const downloaded = Buffer.from(await download.arrayBuffer())
    assert.deepEqual(downloaded, content)
    assert.equal(createHash('sha256').update(downloaded).digest('hex'), checksum)

    const ranged = await fetch(`${API}${item.downloadUrl}`, {
      headers: { ...headers, Range: 'bytes=0-3' },
    })
    assert.equal(ranged.status, 206)
    assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), content.subarray(0, 4))

    // 撤销授权后 manifest 拒绝
    await call(`/api/offline/entitlements/${grant.data.id}/revoke`, { method: 'POST', body: '{}' })
    const revokedManifest = await call(
      `/api/offline/packages/${pkg.data.id}/manifest?deviceId=${encodeURIComponent(deviceId)}`,
    )
    assert.equal(revokedManifest.status, 403)

    // 过期授权：重新授权 1 秒，到期后拒绝并可清理
    const shortGrant = await call(`/api/offline/packages/${pkg.data.id}/entitlements`, {
      method: 'POST',
      body: JSON.stringify({
        userId: session.user.id,
        deviceId,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      }),
    })
    assert.equal(shortGrant.status, 201)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const expired = await call(
      `/api/offline/packages/${pkg.data.id}/manifest?deviceId=${encodeURIComponent(deviceId)}`,
    )
    assert.equal(expired.status, 403)
    sql(`UPDATE offline_entitlements SET status='active' WHERE id='${shortGrant.data.id}'`)
    const cleanup = await call('/api/offline/cleanup', { method: 'POST', body: '{}' })
    assert.ok(cleanup.data.expired >= 1)

    // 跨租户拒绝
    const cross = await fetch(`${API}/api/offline/packages`, {
      headers: { ...headers, 'X-Organization-Id': '00000000-0000-4000-8000-000000000000' },
    })
    assert.ok([400, 403, 404].includes(cross.status), `cross tenant ${cross.status}`)

    // 包撤销
    const revoke = await call(`/api/offline/packages/${pkg.data.id}/revoke`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(revoke.status, 200)
    assert.equal(revoke.data.revoked, true)

    console.log('✓ manifest 签名/校验和 + 设备授权 + 短期令牌下载')
    console.log('✓ 撤销/过期拒绝 + cleanup；跨租户拒绝')
    console.log('offline e2e passed')
  } finally {
    sql(`DELETE FROM offline_entitlements WHERE "packageId" IN (SELECT id FROM offline_packages WHERE key LIKE 'course-%')`)
    sql(`DELETE FROM offline_packages WHERE key LIKE 'course-%'`)
    sql(`DELETE FROM offline_devices WHERE "deviceId"='${deviceId}'`)
    sql(`DELETE FROM assets WHERE id='${assetId}'`)
    rmSync(filePath, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
