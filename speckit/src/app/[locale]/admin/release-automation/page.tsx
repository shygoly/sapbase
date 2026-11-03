'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { businessAppsApi } from '@/lib/api/business-apps.api'
import { automationApi } from '@/lib/api/agent-governance.api'

interface PolicyView {
  autonomy?: string
  enabled?: boolean
  allowedChangeClasses?: string[]
  guardrails?: Record<string, unknown>
  autoRollbackEnabled?: boolean
  canaryStages?: number[]
  lastReviewedAt?: string
}

interface AuditView {
  policies?: number
  runs?: number
  rollbacks?: number
  structuralAutoPublishes?: number
  ok?: boolean
}

const CANARY_DEFAULT = [5, 25, 100]

export default function ReleaseAutomationPage() {
  const [appKeys, setAppKeys] = useState<string[]>([])
  const [appKey, setAppKey] = useState<string>('')
  const [policy, setPolicy] = useState<PolicyView | null>(null)
  const [audit, setAudit] = useState<AuditView | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // 默认选中当前组织已安装的第一个应用，避免用户手动输入不存在的 appKey
  useEffect(() => {
    void (async () => {
      try {
        const apps = await businessAppsApi.findAll()
        const keys = (apps ?? []).map((app) => app.appKey).filter(Boolean)
        setAppKeys(keys)
        if (keys.length > 0) setAppKey((prev) => prev || keys[0])
      } catch {
        /* 无已安装应用时保持空，下面会提示 */
      }
    })()
  }, [])

  const load = useCallback(
    async (target: string) => {
      if (!target) return
      setLoading(true)
      try {
        const auditData = await automationApi.audit()
        setAudit((auditData ?? null) as AuditView | null)
        try {
          const policyData = await automationApi.policy(target)
          setPolicy((policyData ?? null) as PolicyView | null)
          setMessage(null)
        } catch {
          setPolicy(null)
        }
      } catch (error) {
        setMessage({ kind: 'err', text: (error as Error).message })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (appKey) void load(appKey)
  }, [appKey, load])

  const enableA2 = async () => {
    if (!appKey) return
    setLoading(true)
    try {
      await automationApi.upsertPolicy(appKey, {
        autonomy: 'A2',
        enabled: true,
        allowedChangeClasses: ['copy', 'changelog', 'menu_label', 'form_layout', 'validation_message'],
        guardrails: { errorRate: 0.01, fiveXxRate: 0.01 },
        autoRollbackEnabled: false,
        canaryStages: CANARY_DEFAULT,
      })
      await load(appKey)
      setMessage({ kind: 'ok', text: '已启用 A2（低风险自动发布）' })
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const disableA2 = async () => {
    if (!appKey) return
    setLoading(true)
    try {
      await automationApi.disable(appKey)
      await load(appKey)
      setMessage({ kind: 'ok', text: '已关闭 A2，回到 A1（仅起草 + 人工发布）' })
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">发布自动化（A2）</h1>
        <p className="text-muted-foreground text-sm">
          人制定策略、平台执行、人事后复核。结构性变更永不进入 A2。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">业务应用</span>
        {appKeys.length > 0 ? (
          <Select value={appKey} onValueChange={setAppKey}>
            <SelectTrigger className="w-64">
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
        <Button variant="outline" onClick={() => void load(appKey)} disabled={loading || !appKey}>
          刷新
        </Button>
        <Button onClick={() => void enableA2()} disabled={loading || !appKey}>
          启用 A2
        </Button>
        <Button variant="outline" onClick={() => void disableA2()} disabled={loading || !appKey}>
          关闭 A2
        </Button>
      </div>

      {message ? (
        <div className={message.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">当前策略</CardTitle>
          <CardDescription>白名单变更类、护栏阈值与灰度阶段。</CardDescription>
        </CardHeader>
        <CardContent>
          {policy ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">自治级别</dt>
                <dd className="mt-1 text-sm font-medium">{policy.autonomy ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">状态</dt>
                <dd className="mt-1">
                  <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                    {policy.enabled ? '已启用' : '未启用'}
                  </Badge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">允许自动发布的变更类</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {(policy.allowedChangeClasses ?? []).length > 0 ? (
                    policy.allowedChangeClasses?.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">未配置</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">灰度阶段（%）</dt>
                <dd className="mt-1 text-sm">{(policy.canaryStages ?? CANARY_DEFAULT).join(' → ')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">自动回退</dt>
                <dd className="mt-1 text-sm">{policy.autoRollbackEnabled ? '已开启' : '未开启'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">护栏阈值</dt>
                <dd className="mt-1 text-sm">
                  {policy.guardrails && Object.keys(policy.guardrails).length > 0
                    ? Object.entries(policy.guardrails)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join('，')
                    : '未配置（只能人工回退）'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              该应用尚未配置 A2 策略。点击「启用 A2」按默认白名单与灰度阶段创建。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">季度审计</CardTitle>
          <CardDescription>本季度 A2 使用范围、回退次数与结构性变更自动发布次数。</CardDescription>
        </CardHeader>
        <CardContent>
          {audit ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-xs">策略数</dt>
                <dd className="mt-1 text-2xl font-semibold">{audit.policies ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">自动发布次数</dt>
                <dd className="mt-1 text-2xl font-semibold">{audit.runs ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">回退次数</dt>
                <dd className="mt-1 text-2xl font-semibold">{audit.rollbacks ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">结构性变更自动发布</dt>
                <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                  {audit.structuralAutoPublishes ?? 0}
                  <Badge variant={audit.ok ? 'default' : 'destructive'}>{audit.ok ? '合规' : '异常'}</Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">暂无审计数据。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
