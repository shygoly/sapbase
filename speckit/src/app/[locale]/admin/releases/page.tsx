'use client'

import { useEffect, useState } from 'react'
import { releasesApi, type ReleaseView } from '@/lib/api/releases.api'

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    releasesApi
      .list()
      .then(setReleases)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Releases</h1>
        <p className="text-muted-foreground text-sm">不可变发布目录、激活与回退入口。</p>
      </div>
      {error ? <div className="text-destructive text-sm">{error}</div> : null}
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">App</th>
              <th className="p-3 text-left">Version</th>
              <th className="p-3 text-left">Channel</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Digest</th>
              <th className="p-3 text-left">Published</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id} className="border-t">
                <td className="p-3">{release.appKey}</td>
                <td className="p-3">{release.version}</td>
                <td className="p-3">{release.channel}</td>
                <td className="p-3">{release.status}</td>
                <td className="p-3 font-mono text-xs">{release.digest?.slice(0, 20)}…</td>
                <td className="p-3">{release.publishedAt ? new Date(release.publishedAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {!loading && releases.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                  暂无 Release
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
