import { BadRequestException } from '@nestjs/common'
import AdmZip from 'adm-zip'
import { inflateSync } from 'node:zlib'

export interface DocumentPage {
  pageNumber: number
  text: string
}

export interface ParsedDocument {
  parser: string
  pages: DocumentPage[]
  text: string
  metadata: Record<string, unknown>
}

export interface DocumentParser {
  readonly name: string
  supports(mimeType: string, fileName: string): boolean
  parse(buffer: Buffer): Promise<ParsedDocument>
}

const MAX_BYTES = Number(process.env.DOCUMENT_MAX_BYTES ?? 20 * 1024 * 1024)
const MAX_PAGES = Number(process.env.DOCUMENT_MAX_PAGES ?? 500)
const MAX_ZIP_ENTRIES = 2000
const MAX_UNCOMPRESSED = 100 * 1024 * 1024

export function assertDocumentLimits(buffer: Buffer, pages: number) {
  if (buffer.byteLength > MAX_BYTES) {
    throw new BadRequestException(`文档超过大小上限 ${MAX_BYTES} bytes`)
  }
  if (pages > MAX_PAGES) {
    throw new BadRequestException(`文档超过页数上限 ${MAX_PAGES}`)
  }
}

function safeZip(buffer: Buffer): AdmZip {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new BadRequestException(`文档 zip 条目超过上限 ${MAX_ZIP_ENTRIES}`)
  }
  let total = 0
  for (const entry of entries) {
    total += Number(entry.header.size ?? 0)
    if (total > MAX_UNCOMPRESSED) {
      throw new BadRequestException('文档解压后超过上限（疑似 zip bomb）')
    }
    const name = entry.entryName.toLowerCase()
    if (name.includes('vbaproject') || name.endsWith('.bin') || name.endsWith('.exe')) {
      throw new BadRequestException(`拒绝执行型文档内容：${entry.entryName}`)
    }
  }
  return zip
}

function xmlText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<a:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

class TextParser implements DocumentParser {
  readonly name = 'text'
  supports(mimeType: string, fileName: string) {
    return mimeType.startsWith('text/') || /\.(txt|md|markdown|csv|json)$/i.test(fileName)
  }
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const text = buffer.toString('utf8')
    return {
      parser: 'text',
      pages: [{ pageNumber: 1, text }],
      text,
      metadata: { lines: text.split('\n').length },
    }
  }
}

class DocxParser implements DocumentParser {
  readonly name = 'docx'
  supports(_mimeType: string, fileName: string) {
    return /\.docx$/i.test(fileName)
  }
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const zip = safeZip(buffer)
    const entry = zip.getEntry('word/document.xml')
    if (!entry) throw new BadRequestException('DOCX 缺少 word/document.xml')
    const xml = entry.getData().toString('utf8')
    const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => {
      const block = match[0]
      const style = /<w:pStyle w:val="([^"]+)"/.exec(block)?.[1] ?? ''
      const text = xmlText(block).trim()
      return { text, style }
    })
    const lines = paragraphs
      .filter((item) => item.text)
      .map((item) =>
        /^Heading(\d+)$/i.test(item.style)
          ? `${'#'.repeat(Number(/^Heading(\d+)$/i.exec(item.style)?.[1] ?? 1))} ${item.text}`
          : item.text,
      )
    const text = lines.join('\n')
    return {
      parser: 'docx',
      pages: [{ pageNumber: 1, text }],
      text,
      metadata: { paragraphs: paragraphs.length },
    }
  }
}

class PptxParser implements DocumentParser {
  readonly name = 'pptx'
  supports(_mimeType: string, fileName: string) {
    return /\.pptx$/i.test(fileName)
  }
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const zip = safeZip(buffer)
    const slides = zip
      .getEntries()
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
      .sort((a, b) => {
        const na = Number(a.entryName.match(/slide(\d+)\.xml/)?.[1] ?? 0)
        const nb = Number(b.entryName.match(/slide(\d+)\.xml/)?.[1] ?? 0)
        return na - nb
      })
    assertDocumentLimits(buffer, slides.length)
    const pages = slides.map((entry, index) => {
      const xml = entry.getData().toString('utf8')
      const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) =>
        xmlText(match[1]),
      )
      return { pageNumber: index + 1, text: texts.join('\n') }
    })
    return {
      parser: 'pptx',
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      metadata: { slides: pages.length },
    }
  }
}

class PdfParser implements DocumentParser {
  readonly name = 'pdf'
  supports(mimeType: string, fileName: string) {
    return mimeType === 'application/pdf' || /\.pdf$/i.test(fileName)
  }
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const raw = buffer.toString('latin1')
    const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(
      (match) => match[1],
    )
    const pages: DocumentPage[] = []
    for (const stream of streams) {
      let content = Buffer.from(stream, 'latin1')
      try {
        content = inflateSync(content)
      } catch {
        // uncompressed stream
      }
      const text = extractPdfText(content.toString('latin1'))
      if (text.trim()) pages.push({ pageNumber: pages.length + 1, text })
    }
    assertDocumentLimits(buffer, pages.length)
    if (pages.length === 0) {
      throw new BadRequestException('PDF 没有可提取文本层（需要 OCR provider）')
    }
    return {
      parser: 'pdf',
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      metadata: { streams: streams.length },
    }
  }
}

function extractPdfText(content: string): string {
  const lines: string[] = []
  for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const body = block[1]
    const parts: string[] = []
    for (const match of body.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ/g)) {
      const raw = match[0]
      if (raw.endsWith('TJ')) {
        for (const piece of raw.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
          parts.push(unescapePdf(piece[0].slice(1, -1)))
        }
      } else {
        parts.push(unescapePdf(raw.slice(1, raw.lastIndexOf(')'))))
      }
    }
    if (parts.length > 0) lines.push(parts.join(''))
  }
  return lines.join('\n')
}

function unescapePdf(text: string): string {
  return text
    .replace(/\\([nrtbf()\\])/g, (_match, char: string) => {
      const map: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      }
      return map[char] ?? char
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) =>
      String.fromCharCode(parseInt(octal, 8)),
    )
}

export class DocumentParserRegistry {
  private readonly parsers: DocumentParser[] = [
    new TextParser(),
    new DocxParser(),
    new PptxParser(),
    new PdfParser(),
  ]

  resolve(mimeType: string, fileName: string): DocumentParser {
    const parser = this.parsers.find((item) => item.supports(mimeType, fileName))
    if (!parser) throw new BadRequestException(`不支持的文档类型：${mimeType} ${fileName}`)
    return parser
  }

  list(): string[] {
    return this.parsers.map((parser) => parser.name)
  }
}
