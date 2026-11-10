'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { Textarea } from '@sap/app-shared/components/ui/textarea'
import {
  announcementsApi,
  type Announcement,
  type AnnouncementStats,
} from '@sap/api-client'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  scheduled: '定时',
  published: '已发布',
  withdrawn: '已撤回',
  expired: '已过期',
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceType, setAudienceType] = useState<'all' | 'role'>('all')
  const [audienceValue, setAudienceValue] = useState('')
  const [stats, setStats] = useState<Record<string, AnnouncementStats>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await announcementsApi.list())
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!title.trim() || !body.trim()) {
      setMessage('标题和正文必填')
      return
    }
    setSaving(true)
    try {
      await announcementsApi.create({
        title: title.trim(),
        body,
        audienceType,
        audiences:
          audienceType === 'role' && audienceValue.trim()
            ? [{ type: 'role', value: audienceValue.trim() }]
            : [],
      })
      setTitle('')
      setBody('')
      setAudienceValue('')
      setMessage('公告草稿已保存')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const publish = async (id: string) => {
    try {
      const result = await announcementsApi.publish(id)
      setMessage(`已发布，投递 ${result.delivered} 人`)
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const withdraw = async (id: string) => {
    try {
      await announcementsApi.withdraw(id)
      setMessage('公告已撤回')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const loadStats = async (id: string) => {
    try {
      const result = await announcementsApi.stats(id)
      setStats((prev) => ({ ...prev, [id]: result }))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>公告管理</h1>
        <p className='text-muted-foreground text-sm'>
          创建草稿、发布到指定班级/角色或全平台、撤回并查看已读统计。
        </p>
      </div>

      <div className='space-y-3 rounded border p-4'>
        <h2 className='font-medium'>新建公告</h2>
        <div className='space-y-2'>
          <Label htmlFor='announcement-title'>标题</Label>
          <Input
            id='announcement-title'
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder='例如：本周学习任务安排'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='announcement-body'>正文</Label>
          <Textarea
            id='announcement-body'
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder='支持纯文本；后续接入富文本与附件。'
          />
        </div>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='space-y-2'>
            <Label>受众</Label>
            <Select value={audienceType} onValueChange={(value) => setAudienceType(value as 'all' | 'role')}>
              <SelectTrigger className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全平台</SelectItem>
                <SelectItem value='role'>指定角色</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audienceType === 'role' ? (
            <div className='space-y-2'>
              <Label htmlFor='announcement-role'>角色名</Label>
              <Input
                id='announcement-role'
                value={audienceValue}
                onChange={(event) => setAudienceValue(event.target.value)}
                placeholder='teacher'
              />
            </div>
          ) : null}
          <Button onClick={() => void create()} disabled={saving}>
            {saving ? '保存中…' : '保存草稿'}
          </Button>
          <Button variant='outline' onClick={() => void load()}>
            刷新
          </Button>
        </div>
        <p className='text-muted-foreground text-xs'>
          班级/课程 scope 受众将在数据范围 audience 接入后开放。
        </p>
      </div>

      {message ? <div className='text-sm text-muted-foreground'>{message}</div> : null}
      {loading ? <div className='text-muted-foreground text-sm'>加载中…</div> : null}
      {!loading && items.length === 0 ? (
        <div className='text-muted-foreground text-sm'>暂无公告。</div>
      ) : null}

      <div className='space-y-3'>
        {items.map((item) => {
          const stat = stats[item.id]
          return (
            <div key={item.id} className='space-y-2 rounded border p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Badge>
                <span className='font-medium'>{item.title}</span>
                <span className='text-muted-foreground text-xs'>
                  {item.audienceType === 'all' ? '全平台' : item.audienceType}
                </span>
              </div>
              <p className='text-muted-foreground whitespace-pre-wrap text-sm'>{item.body}</p>
              <div className='flex flex-wrap gap-2'>
                {item.status === 'draft' || item.status === 'scheduled' ? (
                  <Button size='sm' onClick={() => void publish(item.id)}>
                    发布
                  </Button>
                ) : null}
                {item.status === 'published' || item.status === 'scheduled' ? (
                  <Button size='sm' variant='outline' onClick={() => void withdraw(item.id)}>
                    撤回
                  </Button>
                ) : null}
                {item.status === 'published' || item.status === 'withdrawn' ? (
                  <Button size='sm' variant='outline' onClick={() => void loadStats(item.id)}>
                    查看统计
                  </Button>
                ) : null}
                {stat ? (
                  <span className='text-muted-foreground self-center text-xs'>
                    投递 {stat.delivered}/{stat.total}，已读 {stat.read}，失败 {stat.failed}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
