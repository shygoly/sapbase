'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { useAuthStore } from '@sap/shared-state'
import {
  identityApi,
  type AuthSessionRecord,
  type LoginEventRecord,
} from '@sap/api-client'

function statusVariant(status: string) {
  if (status === 'active' || status === 'success') return 'default' as const
  if (status === 'revoked' || status === 'failure') return 'destructive' as const
  return 'secondary' as const
}

export default function SecuritySettingsPage() {
  const currentUser = useAuthStore((state) => state.user)
  const [userId, setUserId] = useState(currentUser?.id ?? '')
  const [sessions, setSessions] = useState<AuthSessionRecord[]>([])
  const [events, setEvents] = useState<LoginEventRecord[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const [sessionList, eventList] = await Promise.all([
        identityApi.sessions(userId),
        identityApi.loginEvents({ userId, limit: 50 }),
      ])
      setSessions(sessionList)
      setEvents(eventList)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载会话失败')
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageContainer
      pageTitle='账号安全'
      pageDescription='查看持久会话与登录事件；强制下线后旧 token 立即 401。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>用户 ID</span>
            <Input
              className='w-96 font-mono text-xs'
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder='用户 UUID'
            />
          </div>
          <Button variant='outline' onClick={() => void load()}>
            查询
          </Button>
          <Button
            variant='destructive'
            disabled={!userId}
            onClick={() =>
              void identityApi
                .revokeSessions({ userId, reason: 'portal-force-offline' })
                .then((result) => {
                  setMessage(`已吊销 ${result.revoked} 个会话`)
                  return load()
                })
            }
          >
            强制下线全部会话
          </Button>
        </div>
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>会话</h3>
          {sessions.map((session) => (
            <div key={session.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
              <span className='font-mono text-xs'>{session.sid}</span>
              <span>{session.ip ?? '-'}</span>
              <span className='max-w-80 truncate text-muted-foreground'>
                {session.userAgent ?? '-'}
              </span>
              <span className='text-muted-foreground'>
                到期 {new Date(session.expiresAt).toLocaleString()}
              </span>
              {session.status === 'active' ? (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    void identityApi
                      .revokeSessions({ sid: session.sid, reason: 'portal-revoke' })
                      .then(load)
                  }
                >
                  吊销
                </Button>
              ) : null}
            </div>
          ))}
          {sessions.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无会话</p>
          ) : null}
        </section>

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>登录事件</h3>
          {events.map((event) => (
            <div key={event.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
              <span>{event.provider}</span>
              <span>{event.ip ?? '-'}</span>
              <span className='max-w-80 truncate text-muted-foreground'>
                {event.userAgent ?? '-'}
              </span>
              {event.reason ? <span className='text-destructive'>{event.reason}</span> : null}
              <span className='text-muted-foreground'>
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
          {events.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无登录事件</p>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}
