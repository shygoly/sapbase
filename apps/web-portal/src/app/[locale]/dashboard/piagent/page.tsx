'use client'

import { useState } from 'react'
import { httpClient } from '@sap/app-shared/lib/api/client'

interface AgentEvent {
  type: string
  data: unknown
}

export default function PiAgentPage() {
  const [message, setMessage] = useState('查一下最近的采购单')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setRunning(true)
    setError(null)
    setEvents([])
    try {
      const token = localStorage.getItem('access_token')
      const baseURL = (httpClient.defaults.baseURL ?? '').replace(/\/$/, '')
      const response = await fetch(`${baseURL}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(localStorage.getItem('currentAppId')
            ? { 'X-App-Id': localStorage.getItem('currentAppId') as string }
            : {}),
        },
        body: JSON.stringify({ message }),
      })
      if (!response.ok || !response.body) {
        throw new Error(`agent chat failed: ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const type = /^event:\s*(.+)$/m.exec(chunk)?.[1] ?? 'message'
          const dataLine = /^data:\s*(.+)$/m.exec(chunk)?.[1]
          if (!dataLine) continue
          try {
            setEvents((prev) => [...prev, { type, data: JSON.parse(dataLine) }])
          } catch {
            setEvents((prev) => [...prev, { type, data: dataLine }])
          }
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">PiAgent</h1>
        <p className="text-muted-foreground text-sm">SSE 流式会话；写操作仍需确认令牌。</p>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !running) void send()
          }}
        />
        <button
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          disabled={running}
          onClick={() => void send()}
        >
          {running ? 'Running…' : 'Send'}
        </button>
      </div>
      {error ? <div className="text-destructive text-sm">{error}</div> : null}
      <div className="space-y-2">
        {events.map((event, index) => (
          <div key={`${event.type}-${index}`} className="rounded border p-3 text-xs">
            <div className="font-medium">{event.type}</div>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(event.data, null, 2)}</pre>
          </div>
        ))}
        {!running && events.length === 0 ? (
          <div className="text-muted-foreground text-sm">发送一句话开始会话。</div>
        ) : null}
      </div>
    </div>
  )
}
