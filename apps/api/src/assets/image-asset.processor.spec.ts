import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { LocalObjectStorage } from '@sap/platform-core/assets/local-object-storage'
import { ImageAssetProcessor } from '@sap/platform-core/assets/image-asset.processor'

describe('ImageAssetProcessor', () => {
  let dir: string
  let storage: LocalObjectStorage
  let processor: ImageAssetProcessor

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asset-img-'))
    storage = new LocalObjectStorage({ rootDir: dir })
    processor = new ImageAssetProcessor(storage)
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('剥离 EXIF 并生成 thumbnail/preview', async () => {
    const original = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#3366ff' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-camera' } } })
      .toBuffer()
    const before = await sharp(original).metadata()
    expect(before.exif).toBeDefined()
    const key = 'org/org-1/assets/a1.jpg'
    await storage.put(key, original, { contentType: 'image/jpeg' })
    const result = await processor.process({
      id: 'a1',
      organizationId: 'org-1',
      objectKey: key,
      kind: 'image',
      mimeType: 'image/jpeg',
      originalName: 'a.jpg',
      metadata: null,
    } as never)
    expect(result.status).toBe('ready')
    expect(result.width).toBe(1600)
    expect(result.height).toBe(900)
    expect(result.metadata).toMatchObject({ exifStripped: true })
    expect(result.variants?.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['thumbnail', 'preview']),
    )
    const cleaned = await storage.get(key)
    const after = await sharp(cleaned).metadata()
    expect(after.exif).toBeUndefined()
    expect((await storage.head(result.variants![0]!.objectKey))?.size).toBeGreaterThan(0)
  })

  it('metadata.watermark 生成内容标识', async () => {
    const original = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#111111' },
    })
      .png()
      .toBuffer()
    const key = 'org/org-1/assets/a3.png'
    await storage.put(key, original, { contentType: 'image/png' })
    const result = await processor.process({
      id: 'a3',
      organizationId: 'org-1',
      objectKey: key,
      kind: 'image',
      mimeType: 'image/png',
      originalName: 'a.png',
      metadata: { watermark: 'CONFIDENTIAL' },
    } as never)
    expect(result.metadata).toMatchObject({ watermarkApplied: true })
    const watermarked = await storage.get(key)
    expect(watermarked.length).toBeGreaterThan(0)
  })

  it('按 metadata.crop 生成裁剪变体', async () => {
    const original = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#00aa88' },
    })
      .png()
      .toBuffer()
    const key = 'org/org-1/assets/a2.png'
    await storage.put(key, original, { contentType: 'image/png' })
    const result = await processor.process({
      id: 'a2',
      organizationId: 'org-1',
      objectKey: key,
      kind: 'image',
      mimeType: 'image/png',
      originalName: 'a.png',
      metadata: { crop: { left: 10, top: 20, width: 200, height: 100 } },
    } as never)
    expect(result.variants?.find((item) => item.kind === 'crop')).toMatchObject({
      width: 200,
      height: 100,
    })
  })
})
