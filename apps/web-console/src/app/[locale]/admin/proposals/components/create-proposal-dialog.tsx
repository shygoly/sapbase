'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@sap/app-shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sap/app-shared/components/ui/dialog'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import { Textarea } from '@sap/app-shared/components/ui/textarea'
import { businessAppsApi } from '@sap/app-shared/lib/api/business-apps.api'
import { releasesApi } from '@sap/app-shared/lib/api/releases.api'
import { useLocalePrefix } from '@sap/app-shared/hooks/use-locale'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const TYPES = ['copy', 'form', 'data', 'flow', 'rule', 'permission', 'agent', 'knowledge'] as const

export function CreateProposalDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter()
  const prefix = useLocalePrefix()
  const [apps, setApps] = useState<Array<{ appKey: string; displayName: string }>>([])
  const [appKey, setAppKey] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [type, setType] = useState<(typeof TYPES)[number]>('form')
  const [diffText, setDiffText] = useState('{\n  "forms": []\n}')
  const [evidenceIds, setEvidenceIds] = useState('')
  const [unitTests, setUnitTests] = useState('')
  const [rollbackStrategy, setRollbackStrategy] = useState('deactivate-release')
  const [risk, setRisk] = useState({
    breaking: false,
    permissionChange: false,
    migration: false,
    agentBehaviorChange: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    businessAppsApi
      .findAll()
      .then((rows) => {
        setApps(rows)
        if (!appKey && rows[0]) setAppKey(rows[0].appKey)
      })
      .catch((err: Error) => setError(err.message))
  }, [open, appKey])

  const submit = async () => {
    setError(null)
    if (!appKey) return setError('请选择应用')
    if (!title.trim()) return setError('标题不能为空')
    if (!summary.trim()) return setError('摘要不能为空')
    if (!evidenceIds.trim()) return setError('至少需要一条证据')
    if (!unitTests.trim()) return setError('至少需要一个测试项')
    if (!rollbackStrategy.trim()) return setError('回退计划 strategy 不能为空')

    let diff: Record<string, unknown>
    try {
      const parsed = JSON.parse(diffText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return setError('diff 必须是 JSON 对象')
      }
      diff = parsed as Record<string, unknown>
    } catch {
      return setError('diff 不是合法 JSON')
    }

    setSubmitting(true)
    try {
      const draft = (await releasesApi.createDraft(appKey, {})) as { id: string }
      const proposal = await releasesApi.createProposal({
        appKey,
        draftId: draft.id,
        type,
        areas: [type],
        title,
        summary,
        diff,
        evidence: [{ type: 'feedback', ids: evidenceIds.split(',').map((id) => id.trim()).filter(Boolean) }],
        risk,
        testPlan: { unit: unitTests.split(',').map((item) => item.trim()).filter(Boolean) },
        rollbackPlan: { strategy: rollbackStrategy, dataSafe: true },
      })
      onCreated()
      onOpenChange(false)
      router.push(prefix(`/admin/proposals/${proposal.id}`))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建变更提议</DialogTitle>
          <DialogDescription>服务端硬校验：证据、diff、风险、测试、回退计划都必须完整。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <div className="text-destructive text-sm">{error}</div> : null}
          <div className="space-y-1">
            <Label>应用</Label>
            <select
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              value={appKey}
              onChange={(event) => setAppKey(event.target.value)}
            >
              {apps.map((app) => (
                <option key={app.appKey} value={app.appKey}>
                  {app.displayName}（{app.appKey}）
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>标题</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>类型</Label>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value as (typeof TYPES)[number])}
              >
                {TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>摘要</Label>
            <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>结构化 diff（JSON）</Label>
            <Textarea value={diffText} onChange={(event) => setDiffText(event.target.value)} rows={6} className="font-mono text-xs" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>证据 ids（逗号分隔，至少一条）</Label>
              <Input value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} placeholder="fb_1,fb_2" />
            </div>
            <div className="space-y-1">
              <Label>测试计划（逗号分隔）</Label>
              <Input value={unitTests} onChange={(event) => setUnitTests(event.target.value)} placeholder="proposal.spec.ts" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>回退策略</Label>
            <Input value={rollbackStrategy} onChange={(event) => setRollbackStrategy(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ['breaking', '破坏性'],
                ['permissionChange', '权限变化'],
                ['migration', '迁移'],
                ['agentBehaviorChange', 'Agent 行为变化'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={risk[key]}
                  onChange={(event) => setRisk({ ...risk, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? '提交中…' : '创建提议'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
