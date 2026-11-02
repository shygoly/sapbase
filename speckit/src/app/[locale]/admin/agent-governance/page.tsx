'use client'

import { useEffect, useState } from 'react'
import { evalApi, feedbackApi, knowledgeApi } from '@/lib/api/agent-governance.api'

export default function AgentGovernancePage() {
  const [feedback, setFeedback] = useState<unknown[]>([])
  const [topics, setTopics] = useState<unknown[]>([])
  const [knowledge, setKnowledge] = useState<unknown[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const [f, t, k] = await Promise.all([
        feedbackApi.list(),
        feedbackApi.triage(),
        knowledgeApi.published(),
      ])
      setFeedback(f)
      setTopics(t)
      setKnowledge(k)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Governance</h1>
          <p className="text-muted-foreground text-sm">反馈、议题、知识发布与评测。</p>
        </div>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {message ? <div className="text-destructive text-sm">{message}</div> : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">Feedback</h2>
        <pre className="max-h-48 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(feedback, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Topics</h2>
        <pre className="max-h-48 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(topics, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Published Knowledge</h2>
        <pre className="max-h-48 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(knowledge, null, 2)}
        </pre>
        <button
          className="mt-2 rounded border px-3 py-1 text-sm"
          onClick={() => void evalApi.seed().then(() => setMessage('Golden set seeded'))}
        >
          Seed Golden Set
        </button>
      </section>
    </div>
  )
}
