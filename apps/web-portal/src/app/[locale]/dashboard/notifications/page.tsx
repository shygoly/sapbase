'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { notificationsApi, type NotificationItem } from '@sap/api-client'

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await notificationsApi.list(showAll))
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">通知收件箱</h1>
          <p className="text-muted-foreground text-sm">版本激活、回滚与审批提醒。</p>
        </div>
        <div className="flex gap-2">
          <Button variant={showAll ? 'outline' : 'default'} onClick={() => setShowAll(false)}>
            未读
          </Button>
          <Button variant={showAll ? 'default' : 'outline'} onClick={() => setShowAll(true)}>
            全部
          </Button>
          <Button variant="outline" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>
      {message ? <div className="text-destructive text-sm">{message}</div> : null}
      {loading ? <div className="text-muted-foreground text-sm">加载中…</div> : null}
      {!loading && items.length === 0 ? <div className="text-muted-foreground text-sm">没有通知。</div> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={item.read ? 'secondary' : 'default'}>{item.type}</Badge>
                <span className="font-medium">{item.title}</span>
                {!item.read ? <span className="text-xs text-primary">NEW</span> : null}
              </div>
              {item.body || item.message ? (
                <p className="text-muted-foreground text-sm">{item.body || item.message}</p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
              </p>
            </div>
            {!item.read ? (
              <Button size="sm" variant="outline" onClick={() => void markRead(item.id)}>
                标记已读
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
