import {
  kindFromAssetNameOrMime,
  resolveAssetPolicy,
  validateAssetMetadata,
} from '@sap/platform-core/assets/asset-policy'

describe('asset policy', () => {
  const limits = { maxFileBytes: 100, maxOrgBytes: 1_000, maxConcurrentUploads: 2 }

  it('accepts supported extension and matching MIME', () => {
    expect(
      validateAssetMetadata(
        { originalName: 'lesson.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10 },
        limits,
      ),
    ).toBeNull()
    expect(
      validateAssetMetadata(
        { originalName: 'video.mp4', mimeType: 'video/mp4', size: 10 },
        limits,
      ),
    ).toBeNull()
  })

  it('rejects unknown extension, MIME mismatch and oversize', () => {
    expect(
      validateAssetMetadata({ originalName: 'a.exe', mimeType: 'application/octet-stream', size: 1 }, limits),
    ).toContain('扩展名')
    expect(
      validateAssetMetadata({ originalName: 'a.png', mimeType: 'video/mp4', size: 1 }, limits),
    ).toContain('不匹配')
    expect(
      validateAssetMetadata({ originalName: 'a.png', mimeType: 'image/png', size: 101 }, limits),
    ).toContain('上限')
  })

  it('derives kinds and parses env limits', () => {
    expect(kindFromAssetNameOrMime('a.pdf', 'application/pdf')).toBe('document')
    expect(kindFromAssetNameOrMime('a.mp3', 'audio/mpeg')).toBe('audio')
    expect(
      resolveAssetPolicy({
        ASSET_MAX_FILE_BYTES: '123',
        ASSET_ORG_MAX_BYTES: '456',
        ASSET_MAX_CONCURRENT_UPLOADS: '7',
      } as NodeJS.ProcessEnv),
    ).toEqual({ maxFileBytes: 123, maxOrgBytes: 456, maxConcurrentUploads: 7 })
  })
})
