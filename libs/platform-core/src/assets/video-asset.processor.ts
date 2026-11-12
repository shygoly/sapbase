import { Inject, Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Asset } from './asset.entity'
import type { AssetProcessor, AssetProcessResult, AssetVariantResult } from './asset-processor'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

const execFileAsync = promisify(execFile)

interface ProbeResult {
  durationMs: number
  width: number | null
  height: number | null
  bitrate: number | null
}

async function probe(path: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  )
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; bit_rate?: string }
    streams?: Array<{ codec_type?: string; width?: number; height?: number; bit_rate?: string }>
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video')
  return {
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    width: video?.width ?? null,
    height: video?.height ?? null,
    bitrate: Number(parsed.format?.bit_rate ?? video?.bit_rate ?? 0) || null,
  }
}

@Injectable()
export class VideoAssetProcessor implements AssetProcessor {
  readonly name = 'video'
  readonly kinds = ['video'] as const

  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async process(asset: Asset): Promise<AssetProcessResult> {
    const input = await this.storage.get(asset.objectKey)
    const dir = await mkdtemp(join(tmpdir(), 'asset-video-'))
    const source = join(dir, 'source.bin')
    await writeFile(source, input)
    try {
      const info = await probe(source)
      const maxDuration = Number(
        process.env.ASSET_MAX_VIDEO_DURATION_MS ?? 5 * 60 * 1000,
      )
      if (info.durationMs > maxDuration) {
        throw new Error(
          `视频时长 ${info.durationMs}ms 超过上限 ${maxDuration}ms`,
        )
      }
      const variants: AssetVariantResult[] = []
      const base = `org/${asset.organizationId}/variants/${asset.id}`
      const thumbPath = join(dir, 'thumbnail.jpg')
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-ss',
          String(Math.min(1, Math.max(0, info.durationMs / 2000))),
          '-i',
          source,
          '-frames:v',
          '1',
          '-vf',
          'scale=320:-2',
          thumbPath,
        ],
        { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
      )
      const thumb = await readFile(thumbPath)
      const thumbKey = `${base}/thumbnail.jpg`
      await this.storage.put(thumbKey, thumb, { contentType: 'image/jpeg' })
      variants.push({
        kind: 'thumbnail',
        objectKey: thumbKey,
        mimeType: 'image/jpeg',
        size: thumb.length,
        metadata: { atMs: 1000 },
      })

      const mp4Path = join(dir, 'video.mp4')
      const watermark =
        typeof asset.metadata?.watermark === 'string' ? asset.metadata.watermark : null
      const watermarkFilter = watermark
        ? `drawtext=text='${watermark.replace(/[\\':%]/g, '\\$&')}':x=w-tw-20:y=h-th-20:fontsize=24:fontcolor=white@0.8`
        : null
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          source,
          ...(watermarkFilter ? ['-vf', watermarkFilter] : []),
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          mp4Path,
        ],
        { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
      )
      const mp4 = await readFile(mp4Path)
      const mp4Key = `${base}/video.mp4`
      await this.storage.put(mp4Key, mp4, { contentType: 'video/mp4' })
      variants.push({
        kind: 'mp4',
        objectKey: mp4Key,
        mimeType: 'video/mp4',
        size: mp4.length,
        width: info.width,
        height: info.height,
        metadata: { bitrate: info.bitrate },
      })

      if (asset.metadata?.generateHls === true || process.env.ASSET_VIDEO_HLS === 'true') {
        const hlsDir = join(dir, 'hls')
        await mkdir(hlsDir, { recursive: true })
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-i',
            source,
            ...(watermarkFilter ? ['-vf', watermarkFilter] : []),
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-c:a',
            'aac',
            '-f',
            'hls',
            '-hls_time',
            '4',
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            join(hlsDir, 'segment%03d.ts'),
            join(hlsDir, 'index.m3u8'),
          ],
          { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
        )
        const files = await readdir(hlsDir)
        for (const file of files) {
          const body = await readFile(join(hlsDir, file))
          await this.storage.put(`${base}/hls/${file}`, body, {
            contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
          })
        }
        const playlistKey = `${base}/hls/index.m3u8`
        variants.push({
          kind: 'hls',
          objectKey: playlistKey,
          mimeType: 'application/vnd.apple.mpegurl',
          size: (await readFile(join(hlsDir, 'index.m3u8'))).length,
          width: info.width,
          height: info.height,
          metadata: { segments: files.filter((file) => file.endsWith('.ts')).length },
        })
      }

      if (typeof asset.metadata?.subtitle === 'string' && asset.metadata.subtitle.length > 0) {
        const subtitle = Buffer.from(asset.metadata.subtitle)
        const subtitleKey = `${base}/subtitle.vtt`
        await this.storage.put(subtitleKey, subtitle, { contentType: 'text/vtt' })
        variants.push({
          kind: 'subtitle',
          objectKey: subtitleKey,
          mimeType: 'text/vtt',
          size: subtitle.length,
          metadata: { language: asset.metadata.subtitleLanguage ?? 'und' },
        })
      }

      return {
        status: 'ready',
        width: info.width,
        height: info.height,
        durationMs: info.durationMs,
        metadata: {
          ...(asset.metadata ?? {}),
          durationMs: info.durationMs,
          width: info.width,
          height: info.height,
          bitrate: info.bitrate,
          watermarkApplied: Boolean(watermarkFilter),
        },
        variants,
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
