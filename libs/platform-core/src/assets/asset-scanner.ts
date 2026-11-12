import { Injectable, Logger } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Asset } from './asset.entity'

const execFileAsync = promisify(execFile)

export const ASSET_SCANNER = Symbol('ASSET_SCANNER')

export interface AssetScanResult {
  status: 'clean' | 'infected' | 'error' | 'skipped'
  detail?: string
}

export interface AssetScanner {
  readonly name: string
  scan(asset: Asset, read: () => Promise<Buffer>): Promise<AssetScanResult>
}

/** 本地/测试默认：不伪装成真实病毒扫描；生产应显式配置 clamav。 */
@Injectable()
export class NoopAssetScanner implements AssetScanner {
  readonly name = 'noop'

  async scan(): Promise<AssetScanResult> {
    return { status: 'skipped', detail: '未配置病毒扫描 provider' }
  }
}

/**
 * ClamAV provider：调用本机 clamscan。未安装或执行失败时返回 error，
 * 由处理管道按 fail-closed 处理（不得降级为 ready）。
 */
@Injectable()
export class ClamAvAssetScanner implements AssetScanner {
  readonly name = 'clamav'
  private readonly logger = new Logger(ClamAvAssetScanner.name)

  async scan(asset: Asset, read: () => Promise<Buffer>): Promise<AssetScanResult> {
    let dir: string | null = null
    try {
      const body = await read()
      dir = await mkdtemp(join(tmpdir(), 'asset-scan-'))
      const path = join(dir, 'upload.bin')
      await writeFile(path, body)
      const { stdout } = await execFileAsync('clamscan', ['--no-summary', path], {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      })
      return { status: 'clean', detail: stdout.trim().slice(0, 500) }
    } catch (error) {
      const status = (error as { code?: number }).code
      if (status === 1) {
        return { status: 'infected', detail: 'clamscan 检测到恶意内容' }
      }
      this.logger.warn(`clamscan 失败：${(error as Error).message}`)
      return { status: 'error', detail: (error as Error).message }
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

export function createAssetScanner(provider = process.env.ASSET_SCAN_PROVIDER): AssetScanner {
  return provider === 'clamav' ? new ClamAvAssetScanner() : new NoopAssetScanner()
}
