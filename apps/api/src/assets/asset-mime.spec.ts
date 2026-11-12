import { assertAssetFile, AssetMimeError, sniffMime } from '@sap/platform-core/assets/asset-mime'

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n')
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypisom'),
  Buffer.alloc(16),
])
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])

describe('asset mime sniffing', () => {
  it('识别图片/PDF/MP4/Office', () => {
    expect(sniffMime(PNG, 'a.png')).toBe('image/png')
    expect(sniffMime(PDF, 'a.pdf')).toBe('application/pdf')
    expect(sniffMime(MP4, 'a.mp4')).toBe('video/mp4')
    expect(sniffMime(ZIP, 'a.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })

  it('文本/CSV 归为 document', () => {
    const result = assertAssetFile({
      buffer: Buffer.from('name,age\nA,1\n'),
      filename: 'a.csv',
      declaredMime: 'text/csv',
    })
    expect(result.kind).toBe('document')
    expect(result.mimeType).toBe('text/plain')
  })

  it('声明类型不符/危险扩展名拒绝', () => {
    expect(() =>
      assertAssetFile({
        buffer: PNG,
        filename: 'a.png',
        declaredMime: 'text/plain',
      }),
    ).toThrow(AssetMimeError)
    expect(() =>
      assertAssetFile({ buffer: Buffer.from('MZ'), filename: 'a.exe' }),
    ).toThrow(/扩展名/)
  })

  it('SVG 默认拒绝，含脚本即使开启也拒绝', () => {
    const svg = Buffer.from('<svg><script>alert(1)</script></svg>')
    expect(() =>
      assertAssetFile({ buffer: svg, filename: 'a.svg', declaredMime: 'image/svg+xml' }),
    ).toThrow(/SVG/)
    process.env.ASSET_ALLOW_SVG = 'true'
    try {
      expect(() =>
        assertAssetFile({ buffer: svg, filename: 'a.svg', declaredMime: 'image/svg+xml' }),
      ).toThrow(/脚本/)
    } finally {
      delete process.env.ASSET_ALLOW_SVG
    }
  })

  it('超大文件拒绝', () => {
    expect(() =>
      assertAssetFile({
        buffer: PNG,
        filename: 'a.png',
        size: 300 * 1024 * 1024,
      }),
    ).toThrow(/大小/)
  })
})
