'use client'

import { useState } from 'react'
import { releasesApi, type ReleaseView } from '@/lib/api/releases.api'

export default function WhatsNewPage() {
  const [appKey, setAppKey] = useState('erp-purchase')
  const [installationId, setInstallationId] = useState('')
  const [release, setRelease] = useState<ReleaseView | null>(null)
  const [unread, setUnread] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      const result = await releasesApi.whatsNew(appKey, installationId)
      setRelease(result.release)
      setUnread(result.unread)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const markRead = async () => {
    if (!release) return
    try {
      await releasesApi.markWhatsNewRead(appKey, release.id, installationId)
      setUnread(false)
      setMessage('Marked as read')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">What's New</h1>
        {release?.channel === 'canary' ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">体验版</span>
        ) : null}
        {unread ? <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">NEW</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-1 text-sm" value={appKey} onChange={(e) => setAppKey(e.target.value)} />
        <input
          className="rounded border px-3 py-1 text-sm"
          placeholder="appInstallationId"
          value={installationId}
          onChange={(e) => setInstallationId(e.target.value)}
        />
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void load()}>
          Load
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void markRead()}>
          Mark read
        </button>
      </div>
      {message ? <div className="text-sm">{message}</div> : null}
      <pre className="max-h-96 overflow-auto rounded border bg-muted/30 p-3 text-xs">
        {JSON.stringify(release?.changelog ?? {}, null, 2)}
      </pre>
    </div>
  )
}
