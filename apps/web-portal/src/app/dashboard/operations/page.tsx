'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { operationsApi, type OperationsDashboard } from '@sap/api-client'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function usd(value: number): string {
  return `$${value.toFixed(4)}`
}

export default function OperationsDashboardPage() {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null)
  const [hours, setHours] = useState('24')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (windowHours = hours) => {
    setLoading(true)
    try {
      setDashboard(await operationsApi.dashboard(Number(windowHours)))
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载运维看板失败')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void load()
  }, [load])

  const slo = dashboard?.slo
  const sloRows = slo
    ? [
        {
          key: 'agentSuccessRate',
          label: 'Agent 成功率',
          value: percent(slo.agent.successRate),
          target: `≥ ${percent(slo.targets.agentSuccessRate)}`,
          met: slo.met.agentSuccessRate,
        },
        {
          key: 'toolSuccessRate',
          label: '工具调用成功率',
          value: percent(slo.tools.successRate),
          target: `≥ ${percent(slo.targets.toolSuccessRate)}`,
          met: slo.met.toolSuccessRate,
        },
        {
          key: 'agentP95',
          label: 'Agent P95 延迟',
          value: `${slo.agent.p95LatencyMs} ms`,
          target: `≤ ${slo.targets.agentP95LatencyMs} ms`,
          met: slo.met.agentP95LatencyMs,
        },
        {
          key: 'toolP95',
          label: '工具 P95 延迟',
          value: `${slo.tools.p95LatencyMs} ms`,
          target: `≤ ${slo.targets.toolP95LatencyMs} ms`,
          met: slo.met.toolP95LatencyMs,
        },
        {
          key: 'availability',
          label: '应用可用率',
          value: percent(slo.installations.availability),
          target: `≥ ${percent(slo.targets.installationAvailability)}`,
          met: slo.met.installationAvailability,
        },
      ]
    : []

  return (
    <PageContainer
      pageTitle='运维看板'
      pageDescription='安装与 Agent 运行的审计、SLO、成本与失败聚合；只读既有真源。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4'>
          <span className='text-sm text-muted-foreground'>时间窗口</span>
          <Select
            value={hours}
            onValueChange={(value) => {
              setHours(value)
              void load(value)
            }}
          >
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1'>最近 1 小时</SelectItem>
              <SelectItem value='24'>最近 24 小时</SelectItem>
              <SelectItem value='168'>最近 7 天</SelectItem>
              <SelectItem value='720'>最近 30 天</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline' onClick={() => void load()}>
            刷新
          </Button>
          {dashboard ? (
            <span className='text-xs text-muted-foreground'>
              生成于 {new Date(dashboard.generatedAt).toLocaleString()}
            </span>
          ) : null}
          {message ? <span className='text-sm text-destructive'>{message}</span> : null}
        </div>

        {loading && !dashboard ? (
          <p className='text-sm text-muted-foreground'>加载中…</p>
        ) : null}

        {slo ? (
          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>SLO</h3>
            <div className='grid gap-3 md:grid-cols-5'>
              {sloRows.map((row) => (
                <div key={row.key} className='rounded border p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-xs text-muted-foreground'>{row.label}</span>
                    <Badge variant={row.met ? 'default' : 'destructive'}>
                      {row.met ? '达标' : '未达标'}
                    </Badge>
                  </div>
                  <p className='mt-2 text-lg font-semibold'>{row.value}</p>
                  <p className='text-xs text-muted-foreground'>目标 {row.target}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className='grid gap-4 lg:grid-cols-2'>
          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>审计事件</h3>
            <p className='text-sm text-muted-foreground'>
              共 {dashboard?.audit.total ?? 0} 条安装/Agent 审计事件
            </p>
            <div className='space-y-1'>
              {(dashboard?.audit.byAction ?? []).map((row) => (
                <div key={row.action} className='flex items-center justify-between rounded border p-2 text-sm'>
                  <span className='font-mono text-xs'>{row.action}</span>
                  <span>{row.count}</span>
                </div>
              ))}
              {(dashboard?.audit.byAction ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>窗口内没有安装/Agent 审计事件</p>
              ) : null}
            </div>
            <div className='space-y-1'>
              {(dashboard?.audit.recent ?? []).slice(0, 5).map((row) => (
                <div key={row.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-xs'>
                  <Badge variant={row.status === 'success' ? 'default' : 'destructive'}>
                    {row.status}
                  </Badge>
                  <span className='font-mono'>{row.action}</span>
                  <span className='text-muted-foreground'>{row.actor}</span>
                  <span className='text-muted-foreground'>
                    {new Date(row.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>成本</h3>
            <div className='grid grid-cols-3 gap-3 text-sm'>
              <div>
                <p className='text-xs text-muted-foreground'>输入 tokens</p>
                <p className='font-semibold'>{dashboard?.cost.tokensIn ?? 0}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>输出 tokens</p>
                <p className='font-semibold'>{dashboard?.cost.tokensOut ?? 0}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>估算成本</p>
                <p className='font-semibold'>{usd(dashboard?.cost.estimatedCostUsd ?? 0)}</p>
              </div>
            </div>
            <div className='space-y-1'>
              {(dashboard?.cost.byModel ?? []).map((row) => (
                <div key={row.modelId} className='flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm'>
                  <span className='font-mono text-xs'>{row.modelId}</span>
                  <span className='text-muted-foreground'>
                    {row.tokensIn} in / {row.tokensOut} out
                  </span>
                  <span>{usd(row.estimatedCostUsd)}</span>
                </div>
              ))}
              {(dashboard?.cost.byModel ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>窗口内没有模型调用</p>
              ) : null}
            </div>
            <div className='flex flex-wrap gap-2'>
              {(dashboard?.cost.usage ?? []).map((row) => (
                <Badge key={row.metric} variant='secondary'>
                  {row.metric}: {row.quantity}
                </Badge>
              ))}
            </div>
          </section>

          <section className='space-y-2 rounded-lg border bg-card p-4 lg:col-span-2'>
            <h3 className='font-medium'>失败</h3>
            <div className='flex flex-wrap gap-2 text-sm'>
              <Badge variant='destructive'>Agent 失败/取消：{dashboard?.failures.agentTurns ?? 0}</Badge>
              <Badge variant='destructive'>工具失败：{dashboard?.failures.toolCalls ?? 0}</Badge>
              <Badge variant='destructive'>安装失败/停用：{dashboard?.failures.installations ?? 0}</Badge>
            </div>
            <div className='space-y-1'>
              {(dashboard?.failures.recent ?? []).map((row) => (
                <div key={`${row.kind}-${row.id}`} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
                  <Badge variant='secondary'>{row.kind}</Badge>
                  <Badge variant='destructive'>{row.status}</Badge>
                  <span className='font-mono text-xs'>{row.id}</span>
                  <span className='text-muted-foreground'>{row.detail ?? '-'}</span>
                  <span className='text-muted-foreground'>
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {(dashboard?.failures.recent ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>窗口内没有失败记录</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
