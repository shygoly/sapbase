/**
 * 大文件上传：200MB 单文件、800MB 单次、5GB multipart（稀疏文件，验证大小/配额/分片路径）。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { closeSync, mkdirSync, openSync, rmSync, writeSync, ftruncateSync } = require('node:fs')
const { dirname, join } = require('node:path')

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

function sparseZip(path, size) {
  mkdirSync(dirname(path), { recursive: true })
  const fd = openSync(path, 'w')
  writeSync(fd, Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  ftruncateSync(fd, size)
  closeSync(fd)
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
  const waitAsset = async (id) => {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const result = await call(`/api/assets/${id}`)
      if (!['scanning', 'processing', 'uploading'].includes(result.data?.status)) {
        return result.data
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    throw new Error('asset timeout')
  }
  const assetIds = []
  const keys = []
  try {
    await call('/api/assets/quota', {
      method: 'PATCH',
      body: JSON.stringify({ limitBytes: 10 * 1024 * 1024 * 1024 }),
    })
    const cases = [
      { label: '200MB', size: 200 * 1024 * 1024, multipart: false },
      { label: '800MB', size: 800 * 1024 * 1024, multipart: true },
      { label: '5GB', size: 5 * 1024 * 1024 * 1024, multipart: true },
    ]
    for (const item of cases) {
      const init = await call('/api/asset-uploads', {
        method: 'POST',
        body: JSON.stringify({
          originalName: `e2e-large-${item.label}.zip`,
          mimeType: 'application/zip',
          size: item.size,
          multipart: item.multipart,
        }),
      })
      assert.equal(init.status, 201, `${item.label}: ${JSON.stringify(init.data)}`)
      const path = join(STORAGE_ROOT, init.data.session.objectKey)
      sparseZip(path, item.size)
      keys.push(path)
      const completed = await call(`/api/asset-uploads/${init.data.session.id}/complete`, {
        method: 'POST',
        body: '{}',
      })
      assert.equal(completed.status, 201, `${item.label}: ${JSON.stringify(completed.data)}`)
      assetIds.push(completed.data.assetId)
      const asset = await waitAsset(completed.data.assetId)
      assert.equal(asset.status, 'ready', `${item.label}: ${JSON.stringify(asset)}`)
      assert.equal(Number(asset.size), item.size)
      assert.equal(asset.kind, 'archive')
    }
    console.log('✓ 200MB 单文件 / 800MB multipart / 5GB multipart 上传完成')
    console.log('asset large upload e2e passed')
  } finally {
    if (assetIds.length > 0) {
      const ids = assetIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM asset_variants WHERE "assetId" IN (${ids})`)
      sql(`DELETE FROM assets WHERE id IN (${ids})`)
    }
    for (const key of keys) rmSync(key, { force: true })
    await call('/api/assets/quota', {
      method: 'PATCH',
      body: JSON.stringify({ limitBytes: 5 * 1024 * 1024 * 1024 }),
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
