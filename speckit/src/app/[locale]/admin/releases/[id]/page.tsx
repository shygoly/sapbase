'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { releasesApi, type ReleaseView } from '@/lib/api/releases.api'
import { evalApi } from '@/lib/api/agent-governance.api'

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [release, setRelease] = useState<ReleaseView | null>(null)
  const [impact, setImpact] = useState<{ items: unknown[]; diff: unknown[] } | null>(null)
  const [evalRuns, setEvalRuns] = useState<unknown[]>([])
  const [installationId, setInstallationId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      const detail = await releasesApi.get(id)
      setRelease(detail)
      setImpact(await releasesApi.impact(id))
      setEvalRuns(await evalApi.runs(id))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const activate = async () => {
    try {
      const result = (await releasesApi.activate(id, installationId, 'manual activation')) as { jobId?: string }
      setMessage(`Activation submitted${result?.jobId ? ` ? ${result.jobId}` : ''}`)
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const rollback = async () => {
    try {
      const result = (await releasesApi.rollback(id, installationId, 'manual rollback')) as { jobId?: string }
      setMessage(`Rollback submitted${result?.jobId ? ` ? ${result.jobId}` : ''}`)
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Release {release?.version ?? id}</h1>
      {message ? <div className="text-sm">{message}</div> : null}
      <div className="rounded border p-4">
        <div className="text-sm text-muted-foreground">
          {release ? `${release.appKey} · ${release.channel} · ${release.status}` : 'Loading…'}
        </div>
        <pre className="mt-3 max-h-64 overflow-auto text-xs">{JSON.stringify(release?.changelog ?? {}, null, 2)}</pre>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-1 text-sm"
          placeholder="appInstallationId"
          value={installationId}
          onChange={(event) => setInstallationId(event.target.value)}
        />
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void activate()}>
          Activate
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void rollback()}>
          Rollback
        </button>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => void releasesApi.previewToken(id).then((token) => setMessage(`preview token: ${token.slice(0, 24)}…`))}
        >
          Preview Token
        </button>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">G5 Eval Runs</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(evalRuns, null, 2)}
        </pre>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Impact</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(impact, null, 2)}
        </pre>
      </div>
    </div>
  )
}
