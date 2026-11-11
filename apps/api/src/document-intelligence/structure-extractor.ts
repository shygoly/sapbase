import { createHash } from 'node:crypto'
import type { ParsedDocument } from './document-parser'

export interface ExtractedSection {
  key: string
  parentKey: string | null
  title: string
  level: number
  ordinal: number
  content: string
  pageNumber: number | null
  anchor: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface ExtractedCandidate {
  key: string
  sectionKey: string
  kind: 'knowledge' | 'concept' | 'relation'
  title: string
  body: string
  confidence: number
  anchor: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface StructuredDocument {
  sections: ExtractedSection[]
  candidates: ExtractedCandidate[]
}

export interface StructureExtractor {
  readonly name: string
  extract(document: ParsedDocument): Promise<StructuredDocument>
}

const HEADING = [
  /^(#{1,6})\s+(.+)$/,
  /^(\d+(?:\.\d+)*)[\s、.]+(.+)$/,
  /^(第[一二三四五六七八九十百\d]+[章节部分])\s*(.*)$/,
]

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function redactPii(text: string): string {
  return text
    .replace(/\b1[3-9]\d{9}\b/g, '[PHONE]')
    .replace(/\b\d{17}[\dXx]\b/g, '[ID_CARD]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
}

/** 规则提取：标题/编号 → section；要点/概念行 → candidate；锚点强制。 */
export class RuleStructureExtractor implements StructureExtractor {
  readonly name = 'rule'

  async extract(document: ParsedDocument): Promise<StructuredDocument> {
    const sections: ExtractedSection[] = []
    const candidates: ExtractedCandidate[] = []
    const stack: ExtractedSection[] = []
    let current: ExtractedSection | null = null
    let sectionOrdinal = 0

    const pushSection = (
      title: string,
      level: number,
      pageNumber: number | null,
      line: number,
      quote: string,
    ) => {
      const key = `s-${sectionOrdinal++}`
      const parent = [...stack].reverse().find((item) => item.level < level)
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
      const section: ExtractedSection = {
        key,
        parentKey: parent?.key ?? null,
        title: title.trim().slice(0, 500),
        level,
        ordinal: sectionOrdinal,
        content: '',
        pageNumber,
        anchor: { page: pageNumber, line, quote: quote.slice(0, 200) },
        metadata: { untrusted: true },
      }
      stack.push(section)
      sections.push(section)
      current = section
      return section
    }

    for (const page of document.pages) {
      const lines = page.text.split(/\r?\n/)
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        const trimmed = line.trim()
        if (!trimmed) continue
        const heading = HEADING.map((pattern) => pattern.exec(trimmed)).find(Boolean)
        if (heading) {
          const level = heading[0].startsWith('#')
            ? heading[1].length
            : heading[1].includes('.')
              ? heading[1].split('.').length
              : 1
          const title = heading[2] || heading[1]
          pushSection(title, level, page.pageNumber, index + 1, trimmed)
          continue
        }
        if (!current) {
          current = pushSection('文档内容', 1, page.pageNumber, index + 1, 'document')
        }
        current.content += `${trimmed}\n`

        const candidateMatch =
          /^(?:[-*•]\s*|\d+[.)]\s*)?(?:知识点|概念|定义|要点|掌握|理解)[:：]\s*(.+)$/.exec(
            trimmed,
          ) ??
          (/^[-*•]\s+/.test(trimmed) ? [trimmed, trimmed.replace(/^[-*•]\s+/, '')] : null)
        if (candidateMatch) {
          const title = redactPii(candidateMatch[1]).slice(0, 500)
          const key = `c-${hash(`${current.key}:${index}:${title}`)}`
          const confidence = /^(?:\d|第)/.test(trimmed) ? 0.72 : 0.55
          candidates.push({
            key,
            sectionKey: current.key,
            kind: /概念|定义/.test(trimmed) ? 'concept' : 'knowledge',
            title,
            body: redactPii(trimmed),
            confidence,
            anchor: {
              page: page.pageNumber,
              line: index + 1,
              sectionKey: current.key,
              quote: redactPii(trimmed).slice(0, 300),
            },
            metadata: { untrusted: true, lowConfidence: confidence < 0.6 },
          })
        }
      }
    }

    for (const section of sections) {
      if (candidates.some((candidate) => candidate.sectionKey === section.key)) continue
      const content = section.content.trim()
      if (content.length < 20) continue
      const key = `c-${hash(`${section.key}:summary`)}`
      candidates.push({
        key,
        sectionKey: section.key,
        kind: 'knowledge',
        title: section.title,
        body: redactPii(content.slice(0, 2000)),
        confidence: section.level === 1 ? 0.6 : 0.5,
        anchor: section.anchor,
        metadata: { untrusted: true, lowConfidence: true },
      })
    }

    return {
      sections: sections.length
        ? sections
        : [
            {
              key: 's-0',
              parentKey: null,
              title: '文档内容',
              level: 1,
              ordinal: 0,
              content: redactPii(document.text),
              pageNumber: 1,
              anchor: { page: 1, line: 1, quote: document.text.slice(0, 200) },
              metadata: { untrusted: true },
            },
          ],
      candidates,
    }
  }
}
