'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { businessAppsApi } from '@sap/app-shared/lib/api/business-apps.api'
import { releasesApi, type ReleaseView } from '@sap/app-shared/lib/api/releases.api'

interface Installation {
  id: string
  appKey: string
}

function changelogOf(release: ReleaseView | null) {
  return (
    (release?.changelog as { 'zh-CN'?: { type?: string; title?: string; detail?: string }[] } | undefined)?.[
      'zh-CN'
    ] ?? []
  )
}

export default function ReleasePreviewComparePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [preview, setPreview] = useState<ReleaseView | null>(null)
  const [current, setCurrent] = useState<ReleaseView | null>(null)
  const [installations, setInstallations] = useState<Installation[]>([])
  const [installationId, setInstallationId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    try {
      setPreview(await releasesApi.get(id))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [id])

  const loadCurrent = useCallback(async () => {
    if (!preview || !installationId) return
    try {
      setCurrent(await releasesApi.current(preview.appKey, installationId))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [preview, installationId])

  useEffect(() => {
    void loadPreview()
    void businessAppsApi
      .findAll()
      .then((apps) => {
        const list = (apps ?? []).map((app) => ({ id: app.id, appKey: app.appKey }))
        setInstallations(list)
        if (list[0]) setInstallationId(list[0].id)
      })
      .catch((error: Error) => setMessage(error.message))
  }, [loadPreview])

  useEffect(() => {
    void loadCurrent()
  }, [loadCurrent])

  const currentChangelog = changelogOf(current)
  const previewChangelog = changelogOf(preview)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">发布预览对比</h1>
        <p className="text-muted-foreground text-sm">当前激活版本 vs 待预览版本。</p>
      </div>
      {message ? <div className="text-destructive text-sm">{message}</div> : null}
      <div className="flex items-center gap-2">
        <Select value={installationId} onValueChange={setInstallationId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="选择应用安装记录" />
          </SelectTrigger>
          <SelectContent>
            {installations.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.appKey}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              当前版本
              {current ? <Badge variant="outline">{current.version}</Badge> : null}
            </CardTitle>
            <CardDescription>{current ? `${current.channel} · ${current.status}` : '当前没有激活版本'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentChangelog.length === 0 ? (
              <p className="text-muted-foreground text-sm">无 changelog</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {currentChangelog.map((item, index) => (
                  <li key={`${item.title ?? 'item'}-${index}`}>
                    <span className="font-medium">{item.title ?? '变更'}</span>
                    {item.detail ? <span className="text-muted-foreground"> · {item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
              {JSON.stringify(current?.changelog ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              预览版本
              {preview ? <Badge>{preview.version}</Badge> : null}
            </CardTitle>
            <CardDescription>{preview ? `${preview.channel} · ${preview.status}` : '加载中…'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewChangelog.length === 0 ? (
              <p className="text-muted-foreground text-sm">无 changelog</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {previewChangelog.map((item, index) => (
                  <li key={`${item.title ?? 'item'}-${index}`}>
                    <span className="font-medium">{item.title ?? '变更'}</span>
                    {item.detail ? <span className="text-muted-foreground"> · {item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
              {JSON.stringify(preview?.changelog ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
