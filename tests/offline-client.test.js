const assert = require('node:assert')
const { test } = require('node:test')
const { createHash } = require('node:crypto')

const {
  MemoryOfflineStorage,
  OfflineCache,
  OfflineDownloader,
  OfflinePlayer,
} = require('../libs/api-client/src/offline/client')

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

test('缓存按用户/设备隔离；校验和错误拒绝', async () => {
  const cache = new OfflineCache(new MemoryOfflineStorage())
  const data = Uint8Array.from([1, 2, 3])
  await cache.saveAsset({
    userId: 'u1',
    deviceId: 'd1',
    packageId: 'p1',
    assetId: 'a1',
    data,
    checksum: checksum(data),
  })
  assert.deepEqual(
    await cache.readAsset({ userId: 'u1', deviceId: 'd1', packageId: 'p1', assetId: 'a1' }),
    data,
  )
  assert.equal(
    await cache.readAsset({ userId: 'u2', deviceId: 'd1', packageId: 'p1', assetId: 'a1' }),
    null,
  )
  await assert.rejects(
    cache.saveAsset({
      userId: 'u1',
      deviceId: 'd1',
      packageId: 'p1',
      assetId: 'a2',
      data,
      checksum: 'deadbeef',
    }),
    /checksum/,
  )
})

test('分片下载 + 断点 Range + 批量', async () => {
  const storage = new MemoryOfflineStorage()
  const cache = new OfflineCache(storage)
  const full = Buffer.from('0123456789abcdef')
  const calls = []
  const fakeFetch = async (_url, init) => {
    const range = init.headers.Range
    calls.push(range)
    const [start, end] = range.replace('bytes=', '').split('-').map(Number)
    const chunk = full.subarray(start, end + 1)
    return new Response(chunk, { status: 206 })
  }
  const downloader = new OfflineDownloader(cache, fakeFetch, 4)
  const results = await downloader.downloadBatch({
    userId: 'u1',
    deviceId: 'd1',
    packageId: 'p1',
    tasks: [
      ...Array.from({ length: 5 }, (_, index) => ({
        assetId: `a${index + 1}`,
        url: `/a${index + 1}`,
        size: full.length,
        checksum: checksum(full),
      })),
    ],
  })
  assert.deepEqual(results.map((item) => item.ok), [true, true, true, true, true])
  assert.equal(calls.length, 20)
  const cached = await cache.readAsset({
    userId: 'u1',
    deviceId: 'd1',
    packageId: 'p1',
    assetId: 'a1',
  })
  assert.deepEqual(Buffer.from(cached), full)
})

test('缓存 LRU 上限淘汰旧资产', async () => {
  const cache = new OfflineCache(new MemoryOfflineStorage(), 5)
  const one = Uint8Array.from([1, 2, 3])
  const two = Uint8Array.from([4, 5, 6])
  await cache.saveAsset({ userId: 'u1', deviceId: 'd1', packageId: 'p1', assetId: 'a1', data: one })
  await new Promise((resolve) => setTimeout(resolve, 5))
  await cache.saveAsset({ userId: 'u1', deviceId: 'd1', packageId: 'p1', assetId: 'a2', data: two })
  const first = await cache.readAsset({ userId: 'u1', deviceId: 'd1', packageId: 'p1', assetId: 'a1' })
  const second = await cache.readAsset({ userId: 'u1', deviceId: 'd1', packageId: 'p1', assetId: 'a2' })
  assert.equal(first, null)
  assert.deepEqual(second, two)
})

test('播放校验：过期/设备不符/标识缺失拒绝；偏好按用户隔离', () => {
  const store = new Map()
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  }
  const player = new OfflinePlayer(storage)
  const manifest = {
    offlinePackage: 'v1',
    organizationId: 'org-1',
    key: 'p1',
    version: 1,
    title: 'p',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    contentHash: 'x',
    items: [
      {
        assetId: 'a1',
        objectKey: 'k',
        variant: null,
        mimeType: 'video/mp4',
        size: '1',
        checksum: null,
        label: { explicit: 'AI 生成', implicit: '{}', required: true },
      },
    ],
  }
  assert.equal(player.canPlay({ manifest, userId: 'u1', deviceId: 'd1', entitledDeviceId: 'd1' }).allowed, true)
  assert.deepEqual(player.canPlay({ manifest, userId: 'u1', deviceId: 'd2', entitledDeviceId: 'd1' }), { allowed: false, reason: 'device-mismatch' })
  assert.deepEqual(
    player.canPlay({
      manifest: { ...manifest, expiresAt: new Date(Date.now() - 1000).toISOString() },
      userId: 'u1',
      deviceId: 'd1',
      entitledDeviceId: 'd1',
    }),
    { allowed: false, reason: 'expired' },
  )
  assert.deepEqual(
    player.canPlay({
      manifest: { ...manifest, items: [{ ...manifest.items[0], label: { explicit: null, implicit: null, required: true } }] },
      userId: 'u1',
      deviceId: 'd1',
      entitledDeviceId: 'd1',
    }),
    { allowed: false, reason: 'label-missing' },
  )
  player.setPreferences('u1', { speed: 1.5 })
  assert.equal(player.getPreferences('u1').speed, 1.5)
  assert.equal(player.getPreferences('u2').speed, 1)
})
