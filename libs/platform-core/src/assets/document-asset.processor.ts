import { Inject, Injectable } from '@nestjs/common'
import AdmZip from 'adm-zip'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import type { Asset } from './asset.entity'
import type { AssetProcessor, AssetProcessResult, AssetVariantResult } from './asset-processor'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

const execFileAsync = promisify(execFile)

function countPdfPages(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)
  return matches?.length ?? 0
}

function countDocxPages(buffer: Buffer): number {
  try {
    const xml = new AdmZip(buffer).readAsText('word/document.xml')
    return Math.max(1, (xml.match(/<w:br[^>]*w:type="page"/g)?.length ?? 0) + 1)
  } catch {
    return 0
  }
}

function countPptxSlides(buffer: Buffer): number {
  try {
    return new AdmZip(buffer).getEntries().filter((entry) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName),
    ).length
  } catch {
    return 0
  }
}

@Injectable()
export class DocumentAssetProcessor implements AssetProcessor {
  readonly name = 'document'
  readonly kinds = ['document'] as const

  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async process(asset: Asset): Promise<AssetProcessResult> {
    const body = await this.storage.get(asset.objectKey)
    const name = asset.originalName.toLowerCase()
    let pageCount = 1
    if (asset.mimeType === 'application/pdf' || name.endsWith('.pdf')) {
      pageCount = countPdfPages(body) || 1
    } else if (name.endsWith('.docx')) {
      pageCount = countDocxPages(body) || 1
    } else if (name.endsWith('.pptx')) {
      pageCount = countPptxSlides(body) || 1
    }
    const variants: AssetVariantResult[] = []
    const base = `org/${asset.organizationId}/variants/${asset.id}`
    if ((asset.mimeType === 'application/pdf' || name.endsWith('.pdf')) && pageCount > 0) {
      const dir = await mkdtemp(join(tmpdir(), 'asset-pdf-'))
      try {
        const source = join(dir, 'source.pdf')
        await writeFile(source, body)
        const prefix = join(dir, 'preview')
        await execFileAsync(
          'pdftoppm',
          ['-f', '1', '-l', '1', '-singlefile', '-scale-to', '1280', '-jpeg', source, prefix],
          { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
        )
        const preview = await readFile(`${prefix}.jpg`)
        const previewKey = `${base}/preview.jpg`
        await this.storage.put(previewKey, preview, { contentType: 'image/jpeg' })
        const previewMeta = await sharp(preview).metadata()
        variants.push({
          kind: 'preview',
          objectKey: previewKey,
          mimeType: 'image/jpeg',
          size: preview.length,
          width: previewMeta.width ?? null,
          height: previewMeta.height ?? null,
          metadata: { page: 1 },
        })
        const thumb = await sharp(preview)
          .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()
        const thumbMeta = await sharp(thumb).metadata()
        const thumbKey = `${base}/thumbnail.jpg`
        await this.storage.put(thumbKey, thumb, { contentType: 'image/jpeg' })
        variants.push({
          kind: 'thumbnail',
          objectKey: thumbKey,
          mimeType: 'image/jpeg',
          size: thumb.length,
          width: thumbMeta.width ?? null,
          height: thumbMeta.height ?? null,
        })
      } catch {
        // 预览工具缺失不阻断文档可用性；pageCount 仍保留。
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
    return {
      status: 'ready',
      pageCount,
      metadata: {
        ...(asset.metadata ?? {}),
        pageCount,
        previewGenerated: variants.some((variant) => variant.kind === 'preview'),
      },
      variants,
    }
  }
}
