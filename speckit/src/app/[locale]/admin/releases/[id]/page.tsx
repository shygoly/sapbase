'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { businessAppsApi } from '@/lib/api/business-apps.api'
import { releasesApi, type ReleaseView } from '@/lib/api/releases.api'
import { evalApi } from '@/lib/api/agent-governance.api'

interface EvalRunRow {
  id: string
  suite: string
  passed: number
  failed: number
  modelId?: string | null
  skillVersion?: string | null
  createdAt?: string
}

interface ImpactDiff {
  path?: string
  change?: string
}

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [release, setRelease] = useState<ReleaseView | null>(null)
  const [impact, setImpact] = useState<{ items: unknown[]; diff: ImpactDiff[] } | null>(null)
  const [evalRuns, setEvalRuns] = useState<EvalRunRow[]>([])
  const [installations, setInstallations] = useState<{ id: string; appKey: string }[]>([])
  const [installationId, setInstallationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const detail = await releasesApi.get(id)
      setRelease(detail)
      const [impactData, runs] = await Promise.all([releasesApi.impact(id), evalApi.runs(id)])
      setImpact(impactData as { items: unknown[]; diff: ImpactDiff[] })
      setEvalRuns((runs ?? []) as EvalRunRow[])
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    }
  }, [id])

  useEffect(() => {
    void load()
    void (async () => {
      try {
        const apps = await businessAppsApi.findAll()
        const list = (apps ?? []).map((app) => ({ id: app.id, appKey: app.appKey }))
        setInstallations(list)
        if (list.length > 0) setInstallationId((prev) => prev || list[0].id)
      } catch {
        /* 无安装记录时留空，操作会被后端拒绝并提示 */
      }
    })()
  }, [load])

  const run = async (kind: 'activate' | 'rollback') => {
    if (!installationId) {
      setMessage({ kind: 'err', text: '请先选择目标应用安装记录' })
      return
    }
    setBusy(true)
    try {
      if (kind === 'activate') {
        await releasesApi.activate(id, installationId, '控制台手动激活')
        setMessage({ kind: 'ok', text: '已提交激活' })
      } else {
        await releasesApi.rollback(id, installationId, '控制台手动回滚')
        setMessage({ kind: 'ok', text: '已提交回滚' })
      }
      await load()
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const changelog =
    (release?.changelog as { 'zh-CN'?: { type?: string; title?: string; detail?: string }[] } | undefined)?.[
      'zh-CN'
    ] ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">发布 {release?.version ?? id}</h1>
        {release ? <Badge variant="outline">{release.channel}</Badge> : null}
        {release ? <Badge variant={release.status === 'published' ? 'default' : 'secondary'}>{release.status}</Badge> : null}
      </div>

      {message ? (
        <div className={message.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">发布内容</CardTitle>
          <CardDescription>
            {release
              ? `应用 ${release.appKey} · 摘要 ${release.digest?.slice(0, 20)}…`
              : '加载中…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changelog.length === 0 ? (
            <p className="text-muted-foreground text-sm">该发布未填写 changelog。</p>
          ) : (
            <ul className="space-y-2">
              {changelog.map((item, index) => (
                <li key={`${item.title ?? 'item'}-${index}`} className="text-sm">
                  <span className="font-medium">{item.title ?? '变更'}</span>
                  {item.detail ? <span className="text-muted-foreground"> — {item.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">激活与回滚</CardTitle>
          <CardDescription>激活后该安装记录切换到本版本；回滚会切回上一个可用版本。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {installations.length > 0 ? (
              <Select value={installationId} onValueChange={setInstallationId}>
                <SelectTrigger className="w-72">
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
            ) : (
              <span className="text-muted-foreground text-sm">当前组织没有可用的应用安装记录</span>
            )}
            <Button onClick={() => void run('activate')} disabled={busy || !installationId}>
              激活此版本
            </Button>
            <Button variant="outline" onClick={() => void run('rollback')} disabled={busy || !installationId}>
              回滚
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void releasesApi
                  .previewToken(id)
                  .then((token) => setMessage({ kind: 'ok', text: `预览令牌：${token.slice(0, 24)}…` }))
                  .catch((error: Error) => setMessage({ kind: 'err', text: error.message }))
              }
            >
              生成预览令牌
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">评测记录（G5 闸门证据）</CardTitle>
          <CardDescription>发布涉及的 Agent 行为变更，需要这些评测记录支撑。</CardDescription>
        </CardHeader>
        <CardContent>
          {evalRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无评测记录。涉及 Agent 变更时会强制要求。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>套件</TableHead>
                  <TableHead>通过</TableHead>
                  <TableHead>失败</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>技能版本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evalRuns.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.suite}</TableCell>
                    <TableCell>{row.passed}</TableCell>
                    <TableCell>{row.failed}</TableCell>
                    <TableCell>{row.modelId ?? '-'}</TableCell>
                    <TableCell>{row.skillVersion ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">影响面</CardTitle>
          <CardDescription>与上一个版本的差异路径。</CardDescription>
        </CardHeader>
        <CardContent>
          {(impact?.diff ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">与上一版本无差异（或这是首个版本）。</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(impact?.diff ?? []).map((item, index) => (
                <li key={`${item.path ?? index}`} className="flex items-center gap-2">
                  <Badge variant="outline">{item.change ?? 'changed'}</Badge>
                  <code className="text-xs">{item.path ?? '-'}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
