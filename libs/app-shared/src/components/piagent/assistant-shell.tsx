'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, Send, Square, X } from 'lucide-react'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { useOrganizationStore } from '@sap/shared-state/core/store/organization.store'
import { agentToolsApi } from '../../lib/api/agent-tools.api'
import { chatApi } from '../../lib/api/chat.api'
import {
  PlanRenderer,
  type PlanActionEvent,
} from '../../core/interaction/plan-renderer'
import {
  assistantMessage,
  dismissSurface,
  isSurfaceEntry,
  surfaceEntry,
  userMessage,
  type ChatEntry,
} from '../../features/chat/session'

import {
  buildContextSuffix,
  quickPrompts,
  type ContextChip,
  type PiAgentMode,
} from './context'

export { buildContextSuffix, quickPrompts } from './context'
export type { ContextChip, PiAgentMode } from './context'

function formatResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

const BALL_HIDDEN_KEY = 'piagent.ball.hidden'

/**
 * 壳层 PiAgent 助手：
 * - 固定触发器始终在 Header；悬浮球只是可选第二入口，可关。
 * - 帮助（只读）与协助操作（写操作先确认）共用同一面板。
 * - 面板带可移除上下文芯片；不接管业务页。
 */
export function PiAgentShell() {
  const pathname = usePathname()
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PiAgentMode>('help')
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [sending, setSending] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [ballHidden, setBallHidden] = useState(false)
  const [entityId, setEntityId] = useState('')
  const [dismissedChips, setDismissedChips] = useState<string[]>([])
  const requestRef = useRef(0)

  useEffect(() => {
    try {
      setBallHidden(window.localStorage.getItem(BALL_HIDDEN_KEY) === '1')
    } catch {
      setBallHidden(false)
    }
    const params = new URLSearchParams(window.location.search)
    setEntityId(params.get('id') ?? params.get('recordId') ?? '')
  }, [])

  const chips = useMemo<ContextChip[]>(() => {
    const next: ContextChip[] = []
    if (currentOrganization?.id) {
      next.push({
        key: 'org',
        label: `组织：${currentOrganization.name ?? currentOrganization.id}`,
        value: currentOrganization.id,
      })
    }
    next.push({
      key: 'app',
      label: `应用：${process.env.NEXT_PUBLIC_APP_NAME || 'sapbase'}`,
      value: process.env.NEXT_PUBLIC_APP_NAME || 'sapbase',
    })
    if (process.env.NEXT_PUBLIC_RELEASE_ID) {
      next.push({
        key: 'release',
        label: `版本：${process.env.NEXT_PUBLIC_RELEASE_ID}`,
        value: process.env.NEXT_PUBLIC_RELEASE_ID,
      })
    }
    next.push({ key: 'route', label: `路由：${pathname}`, value: pathname })
    if (entityId) {
      next.push({ key: 'entity', label: `实体：${entityId}`, value: entityId })
    }
    return next.filter((chip) => !dismissedChips.includes(chip.key))
  }, [currentOrganization, dismissedChips, entityId, pathname])

  const visibleChips = useMemo(
    () => chips.filter((chip) => !dismissedChips.includes(chip.key)),
    [chips, dismissedChips],
  )

  const hideBall = () => {
    setBallHidden(true)
    try {
      window.localStorage.setItem(BALL_HIDDEN_KEY, '1')
    } catch {
      // localStorage 不可用时只在本次会话隐藏
    }
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const requestId = ++requestRef.current
    setDraft('')
    setSending(true)
    setEntries((prev) => [...prev, userMessage(trimmed)])
    try {
      const result = await chatApi.sendMessage(`${trimmed}${buildContextSuffix(visibleChips)}`)
      if (requestRef.current !== requestId) return
      if (result.kind === 'refusal') {
        setEntries((prev) => [
          ...prev,
          assistantMessage(
            mode === 'help'
              ? `${result.message}\n（未找到已发布依据，已按当前页做只读降级说明；不会执行任何写操作。）`
              : result.message,
          ),
        ])
        return
      }
      setEntries((prev) => [...prev, surfaceEntry(result.plan)])
    } catch (error) {
      if (requestRef.current !== requestId) return
      setEntries((prev) => [
        ...prev,
        assistantMessage((error as Error).message || '助手请求失败'),
      ])
    } finally {
      if (requestRef.current === requestId) setSending(false)
    }
  }

  const stop = () => {
    requestRef.current += 1
    setSending(false)
    setEntries((prev) => [...prev, assistantMessage('已停止等待。')])
  }

  const onSurfaceAction = async (surfaceId: string, event: PlanActionEvent) => {
    if (event.kind === 'cancel') {
      setEntries((prev) => dismissSurface(prev, surfaceId))
      return
    }
    if (event.kind !== 'confirm') return
    setPendingActionId(event.action.id)
    try {
      const invoked = await agentToolsApi.confirmThenInvoke(
        event.action.tool,
        event.action.args ?? {},
      )
      setEntries((prev) => [
        ...dismissSurface(prev, surfaceId),
        assistantMessage(`已执行（确认令牌已消费）：\n${formatResult(invoked)}`),
      ])
    } catch (error) {
      setEntries((prev) => [
        ...prev,
        assistantMessage((error as Error).message || '操作失败，未写入数据'),
      ])
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <>
      <Button
        variant='ghost'
        size='sm'
        className='gap-1'
        aria-label='打开 PiAgent 助手'
        onClick={() => setOpen((value) => !value)}
      >
        <Bot className='h-4 w-4' />
        <span className='hidden sm:inline'>助手</span>
      </Button>

      {!ballHidden && !open ? (
        <div className='fixed right-6 bottom-6 z-40 flex items-center gap-1'>
          <Button
            size='icon'
            className='h-11 w-11 rounded-full shadow-lg'
            aria-label='打开 PiAgent 助手（悬浮球）'
            onClick={() => setOpen(true)}
          >
            <Bot className='h-5 w-5' />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='h-6 w-6 rounded-full bg-background/80'
            aria-label='隐藏悬浮球'
            onClick={hideBall}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      ) : null}

      {open ? (
        <aside
          data-piagent-panel='true'
          className='bg-card fixed top-16 right-4 bottom-4 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border shadow-xl'
          aria-label='PiAgent 助手面板'
        >
          <div className='flex items-center justify-between gap-2 border-b px-3 py-2'>
            <div className='flex items-center gap-2'>
              <Bot className='h-4 w-4' />
              <span className='text-sm font-semibold'>PiAgent</span>
              <Badge variant='outline'>当前页</Badge>
            </div>
            <Button
              size='icon'
              variant='ghost'
              className='h-7 w-7'
              aria-label='关闭 PiAgent 助手'
              onClick={() => setOpen(false)}
            >
              <X className='h-4 w-4' />
            </Button>
          </div>

          <div className='flex gap-1 border-b px-3 py-2'>
            <Button
              size='sm'
              variant={mode === 'help' ? 'default' : 'ghost'}
              onClick={() => setMode('help')}
            >
              用法答疑
            </Button>
            <Button
              size='sm'
              variant={mode === 'action' ? 'default' : 'ghost'}
              onClick={() => setMode('action')}
            >
              协助操作
            </Button>
          </div>

          <div className='flex flex-wrap gap-1 border-b px-3 py-2'>
            {visibleChips.length === 0 ? (
              <span className='text-muted-foreground text-xs'>上下文芯片已全部移除</span>
            ) : (
              visibleChips.map((chip) => (
                <span
                  key={chip.key}
                  className='bg-muted inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs'
                >
                  {chip.label}
                  <button
                    type='button'
                    aria-label={`移除上下文 ${chip.key}`}
                    onClick={() =>
                      setDismissedChips((prev) => [...prev, chip.key])
                    }
                  >
                    <X className='h-3 w-3' />
                  </button>
                </span>
              ))
            )}
          </div>

          <ScrollArea className='flex-1'>
            <div className='space-y-3 p-3'>
              {entries.length === 0 ? (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-sm'>
                    {mode === 'help'
                      ? '只读答疑：解释当前页用法、灰显原因与配置入口。'
                      : '协助操作：读工具直接返回；写工具先出确认卡，确认后消费平台令牌。'}
                  </p>
                  {quickPrompts(mode).map((prompt) => (
                    <Button
                      key={prompt}
                      variant='outline'
                      size='sm'
                      className='mr-1 justify-start'
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              ) : null}
              {entries.map((entry) => {
                if (entry.role === 'user') {
                  return (
                    <div key={entry.id} className='flex justify-end'>
                      <div className='bg-primary text-primary-foreground max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap'>
                        {entry.text}
                      </div>
                    </div>
                  )
                }
                if (entry.role === 'assistant') {
                  return (
                    <pre
                      key={entry.id}
                      className='bg-muted max-w-full overflow-x-auto rounded-lg px-3 py-2 text-xs whitespace-pre-wrap'
                    >
                      {entry.text}
                    </pre>
                  )
                }
                if (isSurfaceEntry(entry)) {
                  return (
                    <PlanRenderer
                      key={entry.id}
                      plan={entry.plan}
                      pendingActionId={pendingActionId}
                      onAction={(event) => void onSurfaceAction(entry.id, event)}
                    />
                  )
                }
                return null
              })}
            </div>
          </ScrollArea>

          <form
            className='flex gap-2 border-t p-3'
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={mode === 'help' ? '问这页怎么用…' : '让我查数或起草操作…'}
              aria-label='PiAgent 输入'
              disabled={sending}
            />
            {sending ? (
              <Button type='button' size='icon' variant='outline' aria-label='停止等待' onClick={stop}>
                <Square className='h-4 w-4' />
              </Button>
            ) : (
              <Button type='submit' size='icon' aria-label='发送'>
                <Send className='h-4 w-4' />
              </Button>
            )}
          </form>
        </aside>
      ) : null}
    </>
  )
}
