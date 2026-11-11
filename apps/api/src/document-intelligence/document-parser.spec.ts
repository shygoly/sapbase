import AdmZip from 'adm-zip'
import { DocumentParserRegistry } from './document-parser'
import { RuleStructureExtractor } from './structure-extractor'

function docx(text: string): Buffer {
  const zip = new AdmZip()
  zip.addFile('word/document.xml', Buffer.from(`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`))
  return zip.toBuffer()
}

function pptx(titles: string[]): Buffer {
  const zip = new AdmZip()
  titles.forEach((title, index) => {
    zip.addFile(
      `ppt/slides/slide${index + 1}.xml`,
      Buffer.from(`<p:sld><p:cSld><p:spTree><a:t>${title}</a:t></p:spTree></p:cSld></p:sld>`),
    )
  })
  return zip.toBuffer()
}

describe('DocumentParserRegistry', () => {
  const registry = new DocumentParserRegistry()

  it('TXT/MD 解析', async () => {
    const parser = registry.resolve('text/markdown', 'a.md')
    const result = await parser.parse(Buffer.from('# 第一章\n内容'))
    expect(result.pages[0].text).toContain('第一章')
  })

  it('DOCX 段落解析', async () => {
    const parser = registry.resolve('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')
    const result = await parser.parse(docx('Hello DOCX'))
    expect(result.text).toContain('Hello DOCX')
  })

  it('PPTX 按页解析', async () => {
    const parser = registry.resolve('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'a.pptx')
    const result = await parser.parse(pptx(['第一页', '第二页']))
    expect(result.pages).toHaveLength(2)
    expect(result.pages[1].text).toContain('第二页')
  })

  it('PDF 文本层解析', async () => {
    const parser = registry.resolve('application/pdf', 'a.pdf')
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<<>>stream\nBT /F1 12 Tf (Hello PDF) Tj ET\nendstream\nendobj\n%%EOF',
      'latin1',
    )
    const result = await parser.parse(pdf)
    expect(result.text).toContain('Hello PDF')
  })

  it('不支持类型拒绝；AI DOCX 空文本不崩溃', async () => {
    expect(() => registry.resolve('application/zip', 'a.zip')).toThrow(/不支持/)
    const parser = registry.resolve('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'empty.docx')
    const result = await parser.parse(docx(''))
    expect(result.pages).toHaveLength(1)
  })
})

describe('RuleStructureExtractor', () => {
  const extractor = new RuleStructureExtractor()

  it('编号标题/要点 → sections + candidates；锚点强制', async () => {
    const doc = {
      parser: 'text',
      pages: [
        {
          pageNumber: 1,
          text: '1. 第一章\n知识点：光合作用需要光照\n2. 第二章\n概念：细胞呼吸\n联系 13800138000',
        },
      ],
      text: '',
      metadata: {},
    }
    const result = await extractor.extract(doc)
    expect(result.sections.length).toBeGreaterThanOrEqual(2)
    expect(result.candidates.length).toBeGreaterThanOrEqual(2)
    for (const candidate of result.candidates) {
      expect(candidate.anchor).toBeTruthy()
      expect(candidate.anchor.page).toBe(1)
    }
    expect(result.candidates.some((candidate) => candidate.kind === 'concept')).toBe(true)
    expect(JSON.stringify(result.candidates)).not.toContain('13800138000')
    expect(result.candidates.some((candidate) => candidate.metadata.lowConfidence)).toBe(true)
  })

  it('Markdown 标题层级', async () => {
    const result = await extractor.extract({
      parser: 'text',
      pages: [{ pageNumber: 1, text: '# 一级\n## 二级\ntext' }],
      text: '',
      metadata: {},
    })
    expect(result.sections[0]).toMatchObject({ level: 1 })
    expect(result.sections[1]).toMatchObject({ level: 2, parentKey: result.sections[0].key })
  })
})
