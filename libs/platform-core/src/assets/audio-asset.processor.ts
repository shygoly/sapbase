import { Inject, Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Asset } from './asset.entity'
import type { AssetProcessor, AssetProcessResult, AssetVariantResult } from './asset-processor'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

const execFileAsync = promisify(execFile)

@Injectable()
export class AudioAssetProcessor implements AssetProcessor {
  readonly name = 'audio'
  readonly kinds = ['audio'] as const

  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async process(asset: Asset): Promise<AssetProcessResult> {
    const input = await this.storage.get(asset.objectKey)
    const dir = await mkdtemp(join(tmpdir(), 'asset-audio-'))
    try {
      const source = join(dir, 'source.bin')
      await writeFile(source, input)
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-print_format', 'json', '-show_format', source],
        { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      )
      const parsed = JSON.parse(stdout) as { format?: { duration?: string; bit_rate?: string } }
      const durationMs = Math.round(Number(parsed.format?.duration ?? 0) * 1000)
      const maxDuration = Number(
        process.env.ASSET_MAX_AUDIO_DURATION_MS ?? 60 * 60 * 1000,
      )
      if (durationMs > maxDuration) {
        throw new Error(`音频时长 ${durationMs}ms 超过上限 ${maxDuration}ms`)
      }
      const variants: AssetVariantResult[] = []
      if (asset.metadata?.generateWaveform === true) {
        const waveformPath = join(dir, 'waveform.png')
        await execFileAsync(
          'ffmpeg',
          ['-y', '-i', source, '-filter_complex', 'showwavespic=s=800x200:colors=#4f46e5', '-frames:v', '1', waveformPath],
          { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
        )
        const waveform = await readFile(waveformPath)
        const key = `org/${asset.organizationId}/variants/${asset.id}/waveform.png`
        await this.storage.put(key, waveform, { contentType: 'image/png' })
        variants.push({
          kind: 'waveform',
          objectKey: key,
          mimeType: 'image/png',
          size: waveform.length,
          width: 800,
          height: 200,
        })
      }
      return {
        status: 'ready',
        durationMs,
        metadata: {
          ...(asset.metadata ?? {}),
          durationMs,
          bitrate: Number(parsed.format?.bit_rate ?? 0) || null,
        },
        variants,
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
