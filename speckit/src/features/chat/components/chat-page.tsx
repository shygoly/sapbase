'use client'

import { FormEvent, useState } from 'react'
import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PlanRenderer,
  type PlanActionEvent,
} from '@/core/interaction'
import { getErrorMessage } from '@/core/error/error-handler'
import { useTranslation } from '@/i18n'
import { agentToolsApi } from '@/lib/api/agent-tools.api'
import { chatApi } from '@/lib/api/chat.api'
import {
  assistantMessage,
  dismissSurface,
  isSurfaceEntry,
  surfaceEntry,
  userMessage,
  type ChatEntry,
} from '../session'

function formatInvokeResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

export function ChatPage() {
  const t = useTranslation()
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setDraft('')
    setSending(true)
    const user = userMessage(text)
    setEntries((prev) => [...prev, user])

    try {
      const result = await chatApi.sendMessage(text)
      if (result.kind === 'refusal') {
        setEntries((prev) => [...prev, assistantMessage(result.message)])
        return
      }
      if (result.kind === 'plan') {
        setEntries((prev) => [...prev, surfaceEntry(result.plan)])
        return
      }
      setEntries((prev) => [
        ...prev,
        assistantMessage(t('chat.sendFailed')),
      ])
    } catch (error) {
      setEntries((prev) => [
        ...prev,
        assistantMessage(getErrorMessage(error) || t('chat.sendFailed')),
      ])
    } finally {
      setSending(false)
    }
  }

  async function onSurfaceAction(surfaceId: string, event: PlanActionEvent) {
    if (event.kind === 'cancel') {
      setEntries((prev) => dismissSurface(prev, surfaceId))
      return
    }

    if (event.kind === 'edit') {
      return
    }

    if (event.kind !== 'confirm') {
      return
    }

    setPendingActionId(event.action.id)
    try {
      const invoked = await agentToolsApi.confirmThenInvoke(
        event.action.tool,
        event.action.args ?? {},
      )
      const resultText = `${t('chat.invokeResult')}\n${formatInvokeResult(invoked)}`
      setEntries((prev) => [
        ...dismissSurface(prev, surfaceId),
        assistantMessage(resultText),
      ])
    } catch (error) {
      setEntries((prev) => [
        ...prev,
        assistantMessage(getErrorMessage(error) || t('chat.confirmFailed')),
      ])
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <PageContainer
      pageTitle={t('chat.title')}
      pageDescription={t('chat.description')}
    >
      <div className='flex min-h-[28rem] flex-1 flex-col gap-4'>
        <ScrollArea className='h-[28rem] rounded-md border'>
          <div className='space-y-4 p-4'>
            {entries.length === 0 ? (
              <p className='text-muted-foreground text-sm'>{t('chat.empty')}</p>
            ) : null}
            {entries.map((entry) => {
              if (entry.role === 'user') {
                return (
                  <div key={entry.id} className='flex justify-end'>
                    <div className='bg-primary text-primary-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm'>
                      {entry.text}
                    </div>
                  </div>
                )
              }
              if (entry.role === 'assistant') {
                return (
                  <div key={entry.id} className='flex justify-start'>
                    <pre className='bg-muted max-w-[80%] overflow-x-auto rounded-lg px-3 py-2 text-sm whitespace-pre-wrap'>
                      {entry.text}
                    </pre>
                  </div>
                )
              }
              if (isSurfaceEntry(entry)) {
                return (
                  <div key={entry.id} className='max-w-3xl'>
                    <PlanRenderer
                      plan={entry.plan}
                      pendingActionId={pendingActionId}
                      onAction={(action) => onSurfaceAction(entry.id, action)}
                    />
                  </div>
                )
              }
              return null
            })}
          </div>
        </ScrollArea>
        <form className='flex gap-2' onSubmit={onSubmit}>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('chat.placeholder')}
            disabled={sending}
            aria-label={t('chat.placeholder')}
          />
          <Button type='submit' disabled={sending || draft.trim() === ''}>
            {sending ? t('chat.sending') : t('chat.send')}
          </Button>
        </form>
      </div>
    </PageContainer>
  )
}
