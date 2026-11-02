'use client'

import { useState } from 'react'
import { automationApi } from '@/lib/api/agent-governance.api'

export default function ReleaseAutomationPage() {
  const [appKey, setAppKey] = useState('erp-purchase')
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null)
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      const [p, a] = await Promise.all([automationApi.policy(appKey), automationApi.audit()])
      setPolicy(p)
      setAudit(a)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const enableA2 = async () => {
    try {
      await automationApi.upsertPolicy(appKey, {
        autonomy: 'A2',
        enabled: true,
        allowedChangeClasses: ['copy', 'changelog', 'menu_label', 'form_layout', 'validation_message'],
        guardrails: { errorRate: 0.01, fiveXxRate: 0.01 },
        autoRollbackEnabled: false,
        canaryStages: [5, 25, 100],
      })
      await load()
      setMessage('A2 policy saved')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Release Automation</h1>
        <p className="text-muted-foreground text-sm">A2 白名单、护栏阈值与季度审计。</p>
      </div>
      <div className="flex items-center gap-2">
        <input className="rounded border px-3 py-1 text-sm" value={appKey} onChange={(e) => setAppKey(e.target.value)} />
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void load()}>
          Load
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void enableA2()}>
          Enable A2
        </button>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => void automationApi.disable(appKey).then(load)}
        >
          Disable
        </button>
      </div>
      {message ? <div className="text-sm">{message}</div> : null}
      <section>
        <h2 className="mb-2 text-lg font-medium">Policy</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(policy, null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Quarterly Audit</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(audit, null, 2)}
        </pre>
      </section>
    </div>
  )
}
