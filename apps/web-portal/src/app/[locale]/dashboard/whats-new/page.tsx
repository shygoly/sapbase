'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sap/app-shared/components/ui/select'
import { businessAppsApi } from '@sap/app-shared/lib/api/business-apps.api'
import { releasesApi, type ReleaseView } from '@sap/app-shared/lib/api/releases.api'

interface ChangelogItem {
  type?: string
  title?: string
  detail?: string
}

const TYPE_LABEL: Record<string, string> = {
  added: '新增',
  changed: '调整',
  fixed: '修复',
  removed: '移除',
  deprecated: '弃用',
  security: '安全',
}

export default function WhatsNewPage() {
  const [appKeys, setAppKeys] = useState<string[]>([])
  const [appKey, setAppKey] = useState('')
  const [installationId, setInstallationId] = useState('')
  const [release, setRelease] = useState<ReleaseView | null>(null)
  const [unread, setUnread] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const apps = await businessAppsApi.findAll()
        const list = apps ?? []
        const keys = list.map((app) => app.appKey).filter(Boolean)
        setAppKeys(keys)
        if (keys.length > 0) setAppKey((prev) => prev || keys[0])
        if (list.length > 0) setInstallationId((prev) => prev || list[0].id)
      } catch {
        /* 忽略：未安装应用时下面有提示 */
      }
    })()
  }, [])

  const load = useCallback(async (key: string, installId: string) => {
    if (!key) return
    setLoading(true)
    try {
      const result = await releasesApi.whatsNew(key, installId)
      setRelease(result.release)
      setUnread(result.unread)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (appKey) void load(appKey, installationId)
  }, [appKey, installationId, load])

  const markRead = async () => {
    if (!release) return
    try {
      await releasesApi.markWhatsNewRead(appKey, release.id, installationId)
      setUnread(false)
      setMessage('已标记为已读')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const items: ChangelogItem[] =
    (release?.changelog as { 'zh-CN'?: ChangelogItem[] } | undefined)?.['zh-CN'] ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">更新说明</h1>
        {release?.channel === 'canary' ? <Badge variant="secondary">体验版</Badge> : null}
        {unread ? <Badge>有新内容</Badge> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {appKeys.length > 0 ? (
          <Select value={appKey} onValueChange={setAppKey}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              {appKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">当前组织还没有已安装的业务应用</span>
        )}
        <Button variant="outline" onClick={() => void load(appKey, installationId)} disabled={loading || !appKey}>
          刷新
        </Button>
        <Button variant="outline" onClick={() => void markRead()} disabled={!release || !unread}>
          标记已读
        </Button>
      </div>

      {message ? <div className="text-destructive text-sm">{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {release ? `版本 ${release.version}` : '暂无更新'}
          </CardTitle>
          <CardDescription>
            {release
              ? `${release.channel === 'stable' ? '稳定版' : '预览/灰度版'} · 发布于 ${new Date(release.publishedAt ?? '').toLocaleString('zh-CN')}`
              : '当前应用还没有已激活的发布版本。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {release ? '本次发布没有填写 changelog。' : '发布新版本后，这里会展示面向业务人员的变化说明。'}
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => (
                <li key={`${item.title ?? 'item'}-${index}`} className="flex gap-3">
                  <Badge variant="outline" className="h-5 shrink-0">
                    {TYPE_LABEL[item.type ?? ''] ?? item.type ?? '变更'}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.detail ? (
                      <div className="text-muted-foreground text-sm">{item.detail}</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
