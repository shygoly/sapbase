import type { AssetStatus } from './asset.entity'

const TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  uploading: ['scanning', 'failed', 'deleted'],
  scanning: ['processing', 'quarantined', 'failed'],
  processing: ['ready', 'failed'],
  ready: ['deleted'],
  failed: ['uploading', 'deleted'],
  quarantined: ['deleted'],
  deleted: [],
}

export function canTransitionAssetStatus(from: AssetStatus, to: AssetStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!canTransitionAssetStatus(from, to)) {
    throw new Error(`非法资产状态迁移：${from} → ${to}`)
  }
}

export function isAssetDownloadable(status: AssetStatus): boolean {
  return status === 'ready'
}
