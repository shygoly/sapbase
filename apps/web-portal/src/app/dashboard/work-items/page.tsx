'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { reviewApi, type WorkItem } from '@sap/api-client'

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
}

const SOURCE_LABELS: Record<string, string> = {
  approval: '审批',
  review: '复核',
  task: '教学任务',
  appeal: '申诉',
}

export default function WorkItemsPage() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [unread, setUnread] = useState(0)
  const [status, setStatus] = useState('open')
  const [sourceType, setSourceType] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, count] = await Promise.all([
        reviewApi.listWorkItems({
          status: status === 'all' ? undefined : (status as never),
          sourceType: sourceType === 'all' ? undefined : sourceType,
          unread: unreadOnly,
          assignee: 'me',
          limit: 100,
        }),
        reviewApi.unreadCount('me'),
      ])
      setItems(list)
      setUnread(count.count)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载待办失败')
    } finally {
      setLoading(false)
    }
  }, [status, sourceType, unreadOnly])

  useEffect(() => {
    void load()
  }, [load])

  const markAll = async () => {
    try {
      const result = await reviewApi.markAllRead()
      setMessage(`已标记 ${result.updated} 条为已读`)
      await load()
    } catch (error) {
      setMessage((error as Error).message || '批量已读失败')
    }
  }

  return (
    <PageContainer
      pageTitle='待办中心'
      pageDescription='聚合审批、复核、教学任务与申诉；待办只引用源对象，不复制状态。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>状态</span>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className='w-32' aria-label='待办状态'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='open'>未完成</SelectItem>
                <SelectItem value='done'>已完成</SelectItem>
                <SelectItem value='dismissed'>已忽略</SelectItem>
                <SelectItem value='all'>全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>来源</span>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className='w-36' aria-label='待办来源'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部来源</SelectItem>
                <SelectItem value='approval'>审批</SelectItem>
                <SelectItem value='review'>复核</SelectItem>
                <SelectItem value='task'>教学任务</SelectItem>
                <SelectItem value='appeal'>申诉</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={unreadOnly ? 'default' : 'outline'}
            onClick={() => setUnreadOnly((value) => !value)}
          >
            <Bell className='mr-2 h-4 w-4' />
            仅未读（{unread}）
          </Button>
          <Button variant='outline' onClick={() => void markAll()} disabled={unread === 0}>
            <CheckCheck className='mr-2 h-4 w-4' />
            全部已读
          </Button>
          <Button variant='ghost' onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            刷新
          </Button>
        </div>

        {message ? <div className='text-muted-foreground text-sm'>{message}</div> : null}

        <div className='space-y-2'>
          {items.map((item) => (
            <div
              key={item.id}
              className='flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3'
            >
              <Badge variant='outline'>{SOURCE_LABELS[item.sourceType] ?? item.sourceType}</Badge>
              <Badge variant={item.priority === 'urgent' ? 'destructive' : 'secondary'}>
                {PRIORITY_LABELS[item.priority] ?? item.priority}
              </Badge>
              {!item.readAt ? <Badge variant='default'>未读</Badge> : null}
              <Link
                href={`/dashboard/work-items/${item.sourceId}`}
                className='font-medium underline-offset-4 hover:underline'
                onClick={() => void reviewApi.markRead(item.id)}
              >
                {item.title}
              </Link>
              <span className='text-muted-foreground ml-auto text-xs'>
                {item.dueAt ? `到期 ${new Date(item.dueAt).toLocaleString()}` : '无截止时间'}
              </span>
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <div className='text-muted-foreground rounded-lg border bg-card p-10 text-center text-sm'>
              没有待办。
            </div>
          ) : null}
        </div>
      </div>
    </PageContainer>
  )
}
