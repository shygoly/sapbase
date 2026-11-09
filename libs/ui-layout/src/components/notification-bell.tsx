'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconBell, IconCheck } from '@tabler/icons-react'
import { Button } from '@sap/ui-kit/button'
import { Badge } from '@sap/ui-kit/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@sap/ui-kit/popover'
import { ScrollArea } from '@sap/ui-kit/scroll-area'
import { notificationsApi, type NotificationItem } from '@sap/api-client'

export function NotificationBell() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  const loadCount = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      setCount(await notificationsApi.unreadCount())
    } catch {
      // 通知失败不阻断页面
    }
  }, [])

  const loadRecent = useCallback(async () => {
    try {
      const list = await notificationsApi.list(false)
      setItems(list.slice(0, 8))
      setCount(list.length)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadCount()
    const timer = setInterval(loadCount, 60_000)
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) void loadCount()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadCount])

  useEffect(() => {
    if (open) void loadRecent()
  }, [open, loadRecent])

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setCount((prev) => Math.max(0, prev - 1))
    } catch {
      // ignore
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="通知">
          <IconBell className="h-5 w-5" />
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">通知</span>
          <Badge variant="outline">{count} 未读</Badge>
        </div>
        <ScrollArea className="h-[360px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">没有未读通知</div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">
                        {item.type}
                      </Badge>
                      <span className="truncate text-sm font-medium">{item.title}</span>
                    </div>
                    {item.body || item.message ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.body || item.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
                    </p>
                  </div>
                  {!item.read ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void markRead(item.id)}>
                      <IconCheck className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
