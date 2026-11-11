'use client'

import React from 'react'

export interface AnnouncementAttachmentView {
  name: string
  url: string
}

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      return url.toString()
    }
  } catch {
    return null
  }
  return null
}

/**
 * 行内 Markdown 子集：粗体/斜体/行内代码/链接。
 * 只产出 React 元素与字符串，React 默认转义；危险协议链接降级为纯文本。
 */
export function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:[^()\s]+)\)|\*[^*]+\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index}`
    index += 1
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className='bg-muted rounded px-1 py-0.5 font-mono text-xs'>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^()\s]+)\)$/.exec(token)
      const href = link ? safeHref(link[2]) : null
      if (link && href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary underline underline-offset-2'
          >
            {link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/**
 * 公告正文渲染：安全 Markdown 子集 + 段落/标题/列表/代码块。
 * 不支持原始 HTML；`<script>` 等内容只会作为文本显示。
 */
export function AnnouncementBody({ body }: { body: string }) {
  const lines = String(body ?? '').split(/\r?\n/)
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  let code: string[] | null = null
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const listKey = key++
    const items = list
    blocks.push(
      <ul key={`ul-${listKey}`} className='list-disc space-y-1 pl-5'>
        {items.map((item, index) => (
          <li key={`li-${listKey}-${index}`}>
            {renderInline(item, `li-${listKey}-${index}`)}
          </li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (code) {
        blocks.push(
          <pre key={`pre-${key++}`} className='bg-muted overflow-x-auto rounded p-3 text-xs'>
            {code.join('\n')}
          </pre>,
        )
        code = null
      } else {
        flushList()
        code = []
      }
      continue
    }
    if (code) {
      code.push(line)
      continue
    }
    if (line.trim() === '') {
      flushList()
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      const level = heading[1].length
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4'
      const headingKey = key++
      blocks.push(
        <Tag key={`h-${headingKey}`} className='mt-2 font-semibold'>
          {renderInline(heading[2], `h-${headingKey}`)}
        </Tag>,
      )
      continue
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${key++}`} className='whitespace-pre-wrap'>
        {renderInline(line, `p-${key}`)}
      </p>,
    )
  }
  if (code) {
    blocks.push(
      <pre key={`pre-${key++}`} className='bg-muted overflow-x-auto rounded p-3 text-xs'>
        {code.join('\n')}
      </pre>,
    )
  }
  flushList()

  return <div className='space-y-2 text-sm'>{blocks}</div>
}

/** 附件只渲染 http/https 链接；其他协议不生成可点击元素。 */
export function AnnouncementAttachments({
  attachments,
}: {
  attachments?: AnnouncementAttachmentView[] | null
}) {
  const safe = (attachments ?? []).filter((item) => safeHref(item.url))
  if (safe.length === 0) return null
  return (
    <ul className='flex flex-wrap gap-3 text-sm'>
      {safe.map((item) => (
        <li key={`${item.name}:${item.url}`}>
          <a
            className='text-primary underline underline-offset-2'
            href={safeHref(item.url) ?? '#'}
            target='_blank'
            rel='noopener noreferrer'
          >
            {item.name}
          </a>
        </li>
      ))}
    </ul>
  )
}
