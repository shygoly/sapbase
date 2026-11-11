'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  documentIntelligenceApi,
  type DocumentCandidate,
  type DocumentRun,
  type DocumentSection,
} from '@sap/api-client'

export default function DocumentIntelligencePage() {
  const [runs, setRuns] = useState<DocumentRun[]>([])
  const [active, setActive] = useState<DocumentRun | null>(null)
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [candidates, setCandidates] = useState<DocumentCandidate[]>([])
  const [assetId, setAssetId] = useState('')
  const [packageId, setPackageId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (runId?: string) => {
    try {
      const list = await documentIntelligenceApi.runs()
      setRuns(list)
      const target = list.find((item) => item.id === runId) ?? list[0]
      if (!target) return
      setActive(target)
      const draft = await documentIntelligenceApi.draft(target.id)
      setSections(draft.sections)
      setCandidates(draft.candidates)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      setMessage(success)
      await load(active?.id)
    } catch (error) {
      setMessage((error as Error).message || '操作失败')
    }
  }

  return (
    <PageContainer
      pageTitle='文档智能'
      pageDescription='解析草案 / 章节 / 知识点候选 / 来源锚点 / 人工确认后转换。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>文档资产 ID</span>
            <Input value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder='asset uuid' />
          </div>
          <Button
            onClick={() => void run(() => documentIntelligenceApi.createRun(assetId), '解析任务已创建')}
            disabled={!assetId}
          >
            创建解析
          </Button>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>课程 packageId（转换）</span>
            <Input value={packageId} onChange={(e) => setPackageId(e.target.value)} />
          </div>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <div className='flex flex-wrap gap-2'>
          {runs.map((item) => (
            <Button
              key={item.id}
              size='sm'
              variant={item.id === active?.id ? 'default' : 'outline'}
              onClick={() => void load(item.id)}
            >
              {item.sourceName ?? item.id.slice(0, 8)} · {item.status} · {item.progress}%
            </Button>
          ))}
        </div>

        {active ? (
          <>
            <div className='flex flex-wrap gap-2'>
              <Button
                onClick={() =>
                  void run(
                    () => documentIntelligenceApi.confirmCandidates(active.id),
                    '候选已批量确认',
                  )
                }
                disabled={candidates.length === 0}
              >
                批量确认候选
              </Button>
              <Button
                variant='outline'
                onClick={() => void run(() => documentIntelligenceApi.confirm(active.id), '草案已确认')}
                disabled={active.status !== 'succeeded'}
              >
                确认 draft v{active.draftVersion}
              </Button>
              <Button
                variant='secondary'
                onClick={() =>
                  void run(
                    () =>
                      documentIntelligenceApi.convert(active.id, {
                        targetResourceKey: 'course',
                        packageId,
                        entity: 'CourseSection',
                      }),
                    '已转换为课程实体',
                  )
                }
                disabled={!packageId || active.confirmedVersion !== active.draftVersion}
              >
                转换为课程实体
              </Button>
              <Badge variant='outline'>
                confirmed {active.confirmedVersion ?? '—'} / draft {active.draftVersion}
              </Badge>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2 rounded-lg border bg-card p-4'>
                <h3 className='font-medium'>章节</h3>
                {sections.map((section) => (
                  <div key={section.id} className='border-b py-2 text-sm last:border-b-0'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline'>L{section.level}</Badge>
                      <span className='font-medium'>{section.title}</span>
                      {section.pageNumber ? (
                        <span className='text-muted-foreground text-xs'>P{section.pageNumber}</span>
                      ) : null}
                    </div>
                    <p className='text-muted-foreground line-clamp-3 text-xs'>{section.content}</p>
                  </div>
                ))}
              </div>
              <div className='space-y-2 rounded-lg border bg-card p-4'>
                <h3 className='font-medium'>候选知识点</h3>
                {candidates.map((candidate) => {
                  const low = Number(candidate.confidence) < 0.6
                  return (
                    <div
                      key={candidate.id}
                      className={`border-b py-2 text-sm last:border-b-0 ${low ? 'bg-amber-50' : ''}`}
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant={candidate.status === 'accepted' ? 'default' : 'outline'}>
                          {candidate.status}
                        </Badge>
                        <Badge variant='secondary'>{candidate.kind}</Badge>
                        <span className='font-medium'>{candidate.title}</span>
                        <span className='text-muted-foreground text-xs'>
                          置信度 {candidate.confidence}
                        </span>
                      </div>
                      <p className='text-muted-foreground text-xs'>{candidate.body}</p>
                      <p className='text-muted-foreground text-xs'>
                        锚点 P{String(candidate.anchor.page ?? '—')} · 行{' '}
                        {String(candidate.anchor.line ?? '—')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PageContainer>
  )
}
