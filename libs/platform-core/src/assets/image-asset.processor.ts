import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import type { Asset } from './asset.entity'
import type { AssetProcessor, AssetProcessResult, AssetVariantResult } from './asset-processor'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

function extensionOf(format: string): string {
  return format === 'jpeg' ? 'jpg' : format
}

@Injectable()
export class ImageAssetProcessor implements AssetProcessor {
  readonly name = 'image'
  readonly kinds = ['image'] as const

  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async process(asset: Asset): Promise<AssetProcessResult> {
    const input = await this.storage.get(asset.objectKey)
    const image = sharp(input, { failOn: 'error' })
    const metadata = await image.metadata()
    const format = metadata.format && MIME_BY_FORMAT[metadata.format] ? metadata.format : 'jpeg'
    const mimeType = MIME_BY_FORMAT[format] ?? 'image/jpeg'
    // 不带 withMetadata 输出即剥离 EXIF/ICC；rotate 只应用方向后丢弃原元数据。
    let cleaned = await image
      .rotate()
      .toFormat(format as keyof sharp.FormatEnum, format === 'jpeg' ? { quality: 88 } : {})
      .toBuffer()
    const watermark = asset.metadata?.watermark
    if (typeof watermark === 'string' && watermark.length > 0) {
      const escaped = watermark
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const svg = Buffer.from(
        `<svg width="480" height="60"><text x="470" y="40" text-anchor="end" font-size="24" font-family="sans-serif" fill="white" fill-opacity="0.75">${escaped}</text></svg>`,
      )
      cleaned = await sharp(cleaned)
        .composite([{ input: svg, gravity: 'southeast' }])
        .toBuffer()
    }
    await this.storage.put(asset.objectKey, cleaned, { contentType: mimeType })
    const cleanedMeta = await sharp(cleaned).metadata()
    const width = cleanedMeta.width ?? null
    const height = cleanedMeta.height ?? null
    const variants: AssetVariantResult[] = []
    const base = `org/${asset.organizationId}/variants/${asset.id}`
    const addVariant = async (
      kind: string,
      body: Buffer,
      mime: string,
      extra: Partial<AssetVariantResult> = {},
    ) => {
      const objectKey = `${base}/${kind}.${extensionOf(format)}`
      await this.storage.put(objectKey, body, { contentType: mime })
      variants.push({
        kind,
        objectKey,
        mimeType: mime,
        size: body.length,
        width: extra.width ?? null,
        height: extra.height ?? null,
        metadata: extra.metadata ?? null,
      })
    }
    const thumbnail = await sharp(cleaned)
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    const thumbMeta = await sharp(thumbnail).metadata()
    await addVariant('thumbnail', thumbnail, 'image/jpeg', {
      width: thumbMeta.width,
      height: thumbMeta.height,
    })
    if ((width ?? 0) > 640 || (height ?? 0) > 640) {
      const preview = await sharp(cleaned)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      const previewMeta = await sharp(preview).metadata()
      await addVariant('preview', preview, 'image/jpeg', {
        width: previewMeta.width,
        height: previewMeta.height,
      })
    }
    const crop = asset.metadata?.crop as
      | { left?: number; top?: number; width?: number; height?: number }
      | undefined
    if (
      crop &&
      Number.isFinite(crop.width) &&
      Number.isFinite(crop.height) &&
      (crop.width ?? 0) > 0 &&
      (crop.height ?? 0) > 0
    ) {
      const cropped = await sharp(cleaned)
        .extract({
          left: Math.max(0, Math.floor(crop.left ?? 0)),
          top: Math.max(0, Math.floor(crop.top ?? 0)),
          width: Math.floor(crop.width!),
          height: Math.floor(crop.height!),
        })
        .toBuffer()
      const cropMeta = await sharp(cropped).metadata()
      await addVariant('crop', cropped, mimeType, {
        width: cropMeta.width,
        height: cropMeta.height,
        metadata: { source: 'requested-crop' },
      })
    }
    return {
      status: 'ready',
      width,
      height,
      size: cleaned.length,
      metadata: {
        ...(asset.metadata ?? {}),
        width,
        height,
        format: cleanedMeta.format,
        exifStripped: true,
        watermarkApplied: typeof watermark === 'string' && watermark.length > 0,
        checksum: createHash('sha256').update(cleaned).digest('hex'),
      },
      variants,
    }
  }
}
