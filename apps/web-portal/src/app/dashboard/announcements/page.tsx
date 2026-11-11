'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnnouncementAttachments, AnnouncementBody } from '@sap/app-shared/components/announcement-body'
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
  dataScopeApi,
  type Announcement,
  type AnnouncementDeliveryPage,
  type AnnouncementStats,
  type ScopeNode,
} from '@sap/api-client'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  scheduled: '定时',
  published: '已发布',
  withdrawn: '已撤回',
  expired: '已过期',
}

type AudienceType = Announcement['audienceType']

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  all: '全平台',
  role: '指定角色',
  user: '指定用户',
  scope_node: '范围节点',
  scope_subtree: '范围节点及下级',
}

function parseAttachments(raw: string): Array<{ name: string; url: string }> {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('|')
      const url = rest.join('|').trim()
      return { name: name.trim(), url }
    })
    .filter((item) => item.name && item.url)
}

function toIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceType, setAudienceType] = useState<AudienceType>('all')
  const [audienceValue, setAudienceValue] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [retentionDays, setRetentionDays] = useState('30')
  const [attachmentsText, setAttachmentsText] = useState('')
  const [scopeNodes, setScopeNodes] = useState<ScopeNode[]>([])
  const [stats, setStats] = useState<Record<string, AnnouncementStats>>({})
  const [deliveries, setDeliveries] = useState<Record<string, AnnouncementDeliveryPage>>({})
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

  useEffect(() => {
    dataScopeApi
      .listNodes()
      .then((nodes) => setScopeNodes(nodes))
      .catch(() => setScopeNodes([]))
  }, [])

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
          audienceType !== 'all' && audienceValue.trim()
            ? [{ type: audienceType, value: audienceValue.trim() }]
            : [],
        publishAt: toIso(publishAt),
        retentionDays: Number(retentionDays) || 30,
        attachments: parseAttachments(attachmentsText),
      })
      setTitle('')
      setBody('')
      setAudienceValue('')
      setPublishAt('')
      setAttachmentsText('')
      setMessage('公告草稿已保存')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const publish = async (id: string, force = false) => {
    try {
      const result = await announcementsApi.publish(id, force)
      setMessage(
        result.scheduled
          ? '已设定时发布；到点后由 cron 扇出'
          : result.queued
            ? `已入队扇出，任务 ${result.jobId}`
            : `已发布，投递 ${result.delivered} 人`,
      )
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

  const copy = async (id: string) => {
    try {
      await announcementsApi.copy(id)
      setMessage('已复制为草稿')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('删除后列表不再显示（软删除，审计仍可追溯）。继续？')) return
    try {
      await announcementsApi.remove(id)
      setMessage('公告已删除')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const loadStats = async (id: string, page = 1) => {
    try {
      const [stat, detail] = await Promise.all([
        announcementsApi.stats(id),
        announcementsApi.deliveries(id, { page, pageSize: 20 }),
      ])
      setStats((prev) => ({ ...prev, [id]: stat }))
      setDeliveries((prev) => ({ ...prev, [id]: detail }))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>公告管理</h1>
        <p className='text-muted-foreground text-sm'>
          创建草稿、定时/立即发布到角色、用户或数据范围节点、撤回并查看已读统计与投递明细。
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
          <Label htmlFor='announcement-body'>正文（支持安全 Markdown 子集）</Label>
          <Textarea
            id='announcement-body'
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder='支持 **粗体**、*斜体*、`代码`、[链接](https://example.com)、列表与代码块'
          />
          {body.trim() ? (
            <div className='bg-muted/40 rounded border p-3'>
              <p className='text-muted-foreground mb-1 text-xs'>预览</p>
              <AnnouncementBody body={body} />
            </div>
          ) : null}
        </div>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='space-y-2'>
            <Label>受众</Label>
            <Select
              value={audienceType}
              onValueChange={(value) => {
                setAudienceType(value as AudienceType)
                setAudienceValue('')
              }}
            >
              <SelectTrigger className='w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {AUDIENCE_LABELS[value]}
                  </SelectItem>
                ))}
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

          {audienceType === 'user' ? (
            <div className='space-y-2'>
              <Label htmlFor='announcement-user'>用户 ID</Label>
              <Input
                id='announcement-user'
                value={audienceValue}
                onChange={(event) => setAudienceValue(event.target.value)}
                placeholder='uuid'
              />
            </div>
          ) : null}

          {audienceType === 'scope_node' || audienceType === 'scope_subtree' ? (
            <div className='space-y-2'>
              <Label>范围节点</Label>
              <Select value={audienceValue} onValueChange={setAudienceValue}>
                <SelectTrigger className='w-64'>
                  <SelectValue placeholder='选择节点' />
                </SelectTrigger>
                <SelectContent>
                  {scopeNodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.path} · {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className='space-y-2'>
            <Label htmlFor='announcement-publish-at'>定时发布（可选）</Label>
            <Input
              id='announcement-publish-at'
              type='datetime-local'
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='announcement-retention'>保留期（天）</Label>
            <Input
              id='announcement-retention'
              type='number'
              min={1}
              max={3650}
              className='w-28'
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='announcement-attachments'>附件（每行 name|https://…）</Label>
          <Textarea
            id='announcement-attachments'
            rows={2}
            value={attachmentsText}
            onChange={(event) => setAttachmentsText(event.target.value)}
            placeholder='课程表.pdf|https://example.com/schedule.pdf'
          />
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button onClick={() => void create()} disabled={saving}>
            {saving ? '保存中…' : '保存草稿'}
          </Button>
          <Button variant='outline' onClick={() => void load()}>
            刷新
          </Button>
        </div>
        <p className='text-muted-foreground text-xs'>
          附件只接受 http/https 链接；正文不渲染原始 HTML。大组织发布自动走异步任务扇出。
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
          const detail = deliveries[item.id]
          return (
            <div key={item.id} className='space-y-2 rounded border p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Badge>
                <span className='font-medium'>{item.title}</span>
                <span className='text-muted-foreground text-xs'>
                  {AUDIENCE_LABELS[item.audienceType] ?? item.audienceType}
                </span>
                {item.publishAt ? (
                  <span className='text-muted-foreground text-xs'>
                    定时 {new Date(item.publishAt).toLocaleString()}
                  </span>
                ) : null}
                <span className='text-muted-foreground text-xs'>
                  保留 {item.retentionDays ?? 30} 天
                </span>
              </div>
              <AnnouncementBody body={item.body} />
              <AnnouncementAttachments attachments={item.attachments} />
              <div className='flex flex-wrap gap-2'>
                {item.status === 'draft' || item.status === 'scheduled' ? (
                  <>
                    <Button size='sm' onClick={() => void publish(item.id, true)}>
                      立即发布
                    </Button>
                    {item.status === 'scheduled' ? (
                      <Button size='sm' variant='outline' onClick={() => void publish(item.id)}>
                        保持定时
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {item.status === 'published' || item.status === 'scheduled' ? (
                  <Button size='sm' variant='outline' onClick={() => void withdraw(item.id)}>
                    撤回
                  </Button>
                ) : null}
                <Button size='sm' variant='outline' onClick={() => void copy(item.id)}>
                  复制
                </Button>
                {item.status !== 'published' ? (
                  <Button size='sm' variant='outline' onClick={() => void remove(item.id)}>
                    删除
                  </Button>
                ) : null}
                {item.status === 'published' || item.status === 'withdrawn' || item.status === 'expired' ? (
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
              {detail ? (
                <div className='bg-muted/30 space-y-2 rounded border p-3 text-xs'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>投递明细（{detail.total}）</span>
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={detail.page <= 1}
                        onClick={() => void loadStats(item.id, detail.page - 1)}
                      >
                        上一页
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={detail.page * detail.pageSize >= detail.total}
                        onClick={() => void loadStats(item.id, detail.page + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                  {detail.items.length === 0 ? (
                    <p className='text-muted-foreground'>没有投递记录。</p>
                  ) : (
                    <ul className='space-y-1'>
                      {detail.items.map((row) => (
                        <li key={row.id} className='flex flex-wrap items-center gap-2'>
                          <span className='font-mono'>{row.userId}</span>
                          <Badge variant='outline'>{row.status}</Badge>
                          {row.readAt ? (
                            <span className='text-muted-foreground'>
                              已读 {new Date(row.readAt).toLocaleString()}
                            </span>
                          ) : null}
                          {row.error ? <span className='text-destructive'>{row.error}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
