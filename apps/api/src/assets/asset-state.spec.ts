import { assertAssetTransition, canTransitionAssetStatus, isAssetDownloadable } from './asset-state'

describe('asset state machine', () => {
  it('正常上传链路', () => {
    expect(canTransitionAssetStatus('uploading', 'scanning')).toBe(true)
    expect(canTransitionAssetStatus('scanning', 'processing')).toBe(true)
    expect(canTransitionAssetStatus('processing', 'ready')).toBe(true)
    expect(canTransitionAssetStatus('ready', 'deleted')).toBe(true)
  })

  it('infected 隔离后不可直接 ready', () => {
    expect(canTransitionAssetStatus('scanning', 'quarantined')).toBe(true)
    expect(canTransitionAssetStatus('quarantined', 'ready')).toBe(false)
    expect(() => assertAssetTransition('quarantined', 'ready')).toThrow(/非法资产状态迁移/)
  })

  it('只有 ready 可下载', () => {
    expect(isAssetDownloadable('ready')).toBe(true)
    for (const status of ['uploading', 'scanning', 'processing', 'failed', 'quarantined', 'deleted'] as const) {
      expect(isAssetDownloadable(status)).toBe(false)
    }
  })
})
