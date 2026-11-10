'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Label } from '@sap/app-shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { Switch } from '@sap/app-shared/components/ui/switch'
import {
  notificationsApi,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPreference,
} from '@sap/api-client'

const CATEGORIES: Array<{ value: 'all' | NotificationCategory; label: string }> = [
  { value: 'all', label: '全部分类' },
  { value: 'system', label: '系统' },
  { value: 'approval', label: '审批' },
  { value: 'announcement', label: '公告' },
  { value: 'task', label: '任务' },
  { value: 'security', label: '安全' },
  { value: 'business', label: '业务' },
]

const PREFERENCE_CATEGORIES: NotificationCategory[] = [
  'system',
  'approval',
  'announcement',
  'task',
  'security',
  'business',
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((item) => [item.value, item.label]),
)

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [showAll, setShowAll] = useState(false)
  const [category, setCategory] = useState<'all' | NotificationCategory>('all')
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(
        await notificationsApi.list(showAll, {
          category: category === 'all' ? undefined : category,
        }),
      )
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [category, showAll])

  const loadPreferences = useCallback(async () => {
    try {
      setPreferences(await notificationsApi.preferences())
    } catch {
      setPreferences([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items])

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const updatePreference = async (
    categoryKey: NotificationCategory,
    patch: Partial<NotificationPreference>,
  ) => {
    const current =
      preferences.find((item) => item.category === categoryKey) ??
      ({ category: categoryKey, inApp: true, email: false, push: false } as NotificationPreference)
    const next = { ...current, ...patch }
    setPreferences((prev) => {
      const others = prev.filter((item) => item.category !== categoryKey)
      return [...others, next]
    })
    try {
      await notificationsApi.updatePreference(categoryKey, {
        inApp: next.inApp,
        email: next.email,
        push: next.push,
      })
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold'>消息中心</h1>
          <p className='text-muted-foreground text-sm'>
            系统通知、待办提醒、公告与审核消息。当前未读 {unreadCount} 条。
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant={showAll ? 'outline' : 'default'} onClick={() => setShowAll(false)}>
            未读
          </Button>
          <Button variant={showAll ? 'default' : 'outline'} onClick={() => setShowAll(true)}>
            全部
          </Button>
          <Button variant='outline' onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            全部已读
          </Button>
          <Button variant='outline' onClick={() => setShowPreferences((value) => !value)}>
            推送设置
          </Button>
          <Button variant='outline' onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <Label className='text-muted-foreground text-sm'>分类</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as 'all' | NotificationCategory)}
        >
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showPreferences ? (
        <div className='rounded border p-4'>
          <div className='mb-3'>
            <h2 className='font-medium'>消息推送设置</h2>
            <p className='text-muted-foreground text-xs'>
              站内消息始终保留；邮件和推送按分类开关。强制公告不受开关影响。
            </p>
          </div>
          <div className='space-y-3'>
            {PREFERENCE_CATEGORIES.map((categoryKey) => {
              const preference =
                preferences.find((item) => item.category === categoryKey) ??
                ({ category: categoryKey, inApp: true, email: false, push: false } as NotificationPreference)
              return (
                <div key={categoryKey} className='flex flex-wrap items-center gap-6 text-sm'>
                  <span className='w-20 font-medium'>{CATEGORY_LABELS[categoryKey]}</span>
                  <label className='flex items-center gap-2'>
                    <Switch
                      checked={preference.inApp}
                      onCheckedChange={(checked) =>
                        void updatePreference(categoryKey, { inApp: checked })
                      }
                    />
                    站内
                  </label>
                  <label className='flex items-center gap-2'>
                    <Switch
                      checked={preference.email}
                      onCheckedChange={(checked) =>
                        void updatePreference(categoryKey, { email: checked })
                      }
                    />
                    邮件
                  </label>
                  <label className='flex items-center gap-2'>
                    <Switch
                      checked={preference.push}
                      onCheckedChange={(checked) =>
                        void updatePreference(categoryKey, { push: checked })
                      }
                    />
                    推送
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {message ? <div className='text-destructive text-sm'>{message}</div> : null}
      {loading ? <div className='text-muted-foreground text-sm'>加载中…</div> : null}
      {!loading && items.length === 0 ? (
        <div className='text-muted-foreground text-sm'>没有通知。</div>
      ) : null}

      <div className='space-y-2'>
        {items.map((item) => (
          <div key={item.id} className='flex items-start justify-between gap-4 rounded border p-3'>
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={item.read ? 'secondary' : 'default'}>{item.type}</Badge>
                {item.category ? <Badge variant='outline'>{CATEGORY_LABELS[item.category]}</Badge> : null}
                {item.priority && item.priority !== 'normal' ? (
                  <Badge variant='destructive'>{item.priority}</Badge>
                ) : null}
                <span className='font-medium'>{item.title}</span>
                {!item.read ? <span className='text-primary text-xs'>NEW</span> : null}
              </div>
              {item.body || item.message ? (
                <p className='text-muted-foreground text-sm'>{item.body || item.message}</p>
              ) : null}
              <p className='text-muted-foreground text-xs'>
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
              </p>
              {item.actionUrl ? (
                <a className='text-primary text-xs hover:underline' href={item.actionUrl}>
                  查看详情
                </a>
              ) : null}
            </div>
            {!item.read ? (
              <Button size='sm' variant='outline' onClick={() => void markRead(item.id)}>
                标记已读
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
