'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Search as SearchIcon } from 'lucide-react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { searchApi, type SearchHit, type SearchResult } from '@sap/api-client'

const TYPES = [
  { value: 'all', label: '全部类型' },
  { value: 'announcement', label: '公告' },
  { value: 'asset', label: '素材' },
  { value: 'ai_module', label: 'AI 模块' },
  { value: 'agent_knowledge', label: '知识' },
]

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPES.filter((item) => item.value !== 'all').map((item) => [item.value, item.label]),
)

function HighlightedSnippet({ snippet }: { snippet: string }) {
  const parts = String(snippet ?? '').split(/(\[\[\[|\]\]\])/)
  let active = false
  return (
    <span>
      {parts.map((part, index) => {
        if (part === '[[[') {
          active = true
          return null
        }
        if (part === ']]]') {
          active = false
          return null
        }
        return active ? (
          <mark key={index} className='bg-primary/20 rounded px-0.5'>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      })}
    </span>
  )
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = useCallback(async (query: string, nextType: string, page = 1) => {
    setLoading(true)
    try {
      const data = await searchApi.query({
        q: query,
        types: nextType === 'all' ? undefined : [nextType],
        page,
        pageSize: 20,
      })
      setResult(data)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run('', 'all')
  }, [run])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <PageContainer
      pageTitle='搜索'
      pageDescription='跨公告、素材、AI 模块与已发布知识；只返回当前组织可见内容。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4'>
          <div className='min-w-64 flex-1 space-y-1'>
            <label htmlFor='search-q' className='text-xs text-muted-foreground'>
              关键词
            </label>
            <div className='relative'>
              <SearchIcon className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
              <Input
                id='search-q'
                className='pl-8'
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void run(q, type)
                }}
                placeholder='输入关键词，例如：课程、Customer、公告'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>类型</span>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value)
                void run(q, value)
              }}
            >
              <SelectTrigger className='w-40' aria-label='搜索类型'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void run(q, type)} disabled={loading}>
            {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            搜索
          </Button>
        </div>

        {message ? <div className='text-destructive text-sm'>{message}</div> : null}
        {result ? (
          <div className='text-muted-foreground text-xs'>
            共 {result.total} 条，{result.tookMs}ms
          </div>
        ) : null}

        <div className='space-y-2'>
          {(result?.items ?? []).map((hit: SearchHit) => (
            <div key={hit.id} className='space-y-1 rounded-lg border bg-card p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>{TYPE_LABELS[hit.resourceKey] ?? hit.resourceKey}</Badge>
                <span className='font-medium'>{hit.title}</span>
                {hit.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant='secondary'>
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className='text-muted-foreground text-sm'>
                <HighlightedSnippet snippet={hit.snippet || hit.title} />
              </p>
            </div>
          ))}
          {result && result.items.length === 0 ? (
            <div className='text-muted-foreground rounded-lg border bg-card p-8 text-center text-sm'>
              没有匹配结果。
            </div>
          ) : null}
        </div>

        {result && result.total > result.pageSize ? (
          <div className='flex items-center justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={result.page <= 1}
              onClick={() => void run(q, type, result.page - 1)}
            >
              上一页
            </Button>
            <span className='text-muted-foreground text-xs'>
              {result.page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={result.page >= totalPages}
              onClick={() => void run(q, type, result.page + 1)}
            >
              下一页
            </Button>
          </div>
        ) : null}
      </div>
    </PageContainer>
  )
}
