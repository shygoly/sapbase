/**
 * Async Jobs 任务中心
 *
 * 列表/筛选/详情/事件/取消/重试/DLQ 重放/回调重放。
 * 判定在服务端；这里只调用 `/api/jobs` 并展示。
 */

'use client'

import React, { useEffect, useState } from 'react'
import {
  jobsApi,
  type Job,
  type JobEvent,
  type JobStatus,
} from '@sap/app-shared/lib/api'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'

const pageModel: PageModel = {
  id: 'jobs-page',
  title: 'Async Jobs',
  description: '任务列表 / 详情 / 事件 / 取消 / 重试 / DLQ / 回调',
  permissions: ['jobs:read'],
}

const STATUSES: JobStatus[] = [
  'queued',
  'running',
  'waiting',
  'succeeded',
  'failed',
  'cancelled',
  'dead',
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function statusClass(status: JobStatus): string {
  switch (status) {
    case 'succeeded':
      return 'text-emerald-600'
    case 'failed':
    case 'dead':
      return 'text-red-600'
    case 'running':
      return 'text-blue-600'
    case 'cancelled':
      return 'text-muted-foreground'
    default:
      return 'text-amber-600'
  }
}

export default function JobsPage() {
  const notification = useNotification()
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<JobStatus | ''>('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Job | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])

  async function refresh(nextPage = page) {
    setLoading(true)
    try {
      const result = await jobsApi.list({
        status: status || undefined,
        type: type.trim() || undefined,
        page: nextPage,
        pageSize: 20,
      })
      setJobs(result.items)
      setTotal(result.total)
      setPage(nextPage)
    } catch (error) {
      notification.error(`加载任务失败：${errorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }

  async function open(job: Job) {
    try {
      const [detail, jobEvents] = await Promise.all([
        jobsApi.get(job.id),
        jobsApi.events(job.id, 0),
      ])
      setSelected(detail)
      setEvents(jobEvents)
    } catch (error) {
      notification.error(errorMessage(error))
    }
  }

  async function act(action: 'cancel' | 'retry' | 'replay' | 'refresh') {
    if (!selected) return
    try {
      if (action === 'cancel') {
        setSelected(await jobsApi.cancel(selected.id))
        notification.success('已请求取消')
      } else if (action === 'retry') {
        setSelected(await jobsApi.retry(selected.id))
        notification.success('已重放为 queued')
      } else if (action === 'replay') {
        const result = await jobsApi.replayCallback(selected.id)
        notification.success(`回调重放：${result.outcome}`)
      }
      setEvents(await jobsApi.events(selected.id, 0))
      setSelected(await jobsApi.get(selected.id))
      await refresh()
    } catch (error) {
      notification.error(errorMessage(error))
    }
  }

  useEffect(() => {
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageRuntime model={pageModel} isLoading={loading}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>任务列表</CardTitle>
            <CardDescription>按组织隔离；共 {total} 条。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void refresh(1)
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="job-status">状态</Label>
                <select
                  id="job-status"
                  className="h-10 rounded-lg border border-input px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as JobStatus | '')}
                >
                  <option value="">全部</option>
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-type">类型</Label>
                <Input
                  id="job-type"
                  placeholder="media.scan"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                />
              </div>
              <Button type="submit">筛选</Button>
              <Button type="button" variant="outline" onClick={() => void refresh()}>
                刷新
              </Button>
            </form>

            <div className="divide-y rounded-lg border">
              {jobs.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">没有任务。</p>
              )}
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/50 ${
                    selected?.id === job.id ? 'bg-muted/60' : ''
                  }`}
                  onClick={() => void open(job)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {job.type}{' '}
                      <span className={`text-xs ${statusClass(job.status)}`}>
                        {job.status}
                      </span>
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {job.id} · attempt {job.attempts}/{job.maxAttempts} ·{' '}
                      {job.progress}%
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">第 {page} 页</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => void refresh(page - 1)}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= total}
                  onClick={() => void refresh(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>任务详情</CardTitle>
            <CardDescription>
              {selected ? selected.id : '选择左侧任务查看状态/事件'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">类型</span>
                  <span className="font-mono">{selected.type}</span>
                  <span className="text-muted-foreground">状态</span>
                  <span className={statusClass(selected.status)}>{selected.status}</span>
                  <span className="text-muted-foreground">进度</span>
                  <span>{selected.progress}%</span>
                  <span className="text-muted-foreground">尝试</span>
                  <span>
                    {selected.attempts}/{selected.maxAttempts}
                  </span>
                  <span className="text-muted-foreground">回调</span>
                  <span>
                    {selected.callbackStatus ?? '-'} ({selected.callbackAttempts})
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!['queued', 'running', 'waiting'].includes(selected.status)}
                    onClick={() => void act('cancel')}
                  >
                    取消
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.status !== 'dead'}
                    onClick={() => void act('retry')}
                  >
                    DLQ 重放
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selected.callbackUrl}
                    onClick={() => void act('replay')}
                  >
                    回调重放
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void act('refresh')}>
                    刷新
                  </Button>
                </div>

                {selected.error && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-red-600">错误</p>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-2 text-xs">
                      {JSON.stringify(selected.error, null, 2)}
                    </pre>
                  </div>
                )}
                {selected.result && (
                  <div>
                    <p className="mb-1 text-xs font-medium">结果</p>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-2 text-xs">
                      {JSON.stringify(selected.result, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-medium">事件（{events.length}）</p>
                  <div className="max-h-72 space-y-1 overflow-auto">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded border px-2 py-1 font-mono text-xs"
                      >
                        <span className="text-muted-foreground">#{event.seq}</span>{' '}
                        <span className="font-medium">{event.type}</span>{' '}
                        {JSON.stringify(event.payload)}
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-xs text-muted-foreground">还没有事件。</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">尚未选择任务。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageRuntime>
  )
}
