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
import {
  metricsApi,
  type Dashboard,
  type MetricQueryResult,
  type DashboardWidget,
} from '@sap/api-client'

export default function MetricsDashboardPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [active, setActive] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<Array<{ widget: DashboardWidget; result: MetricQueryResult }>>([])
  const [compare, setCompare] = useState<'none' | 'previous' | 'year'>('none')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (key?: string, compareMode = compare, rangeDays = days) => {
    setLoading(true)
    try {
      const list = await metricsApi.dashboards()
      setDashboards(list)
      const target = list.find((item) => item.key === key) ?? list[0]
      if (!target) {
        setActive(null)
        setWidgets([])
        return
      }
      setActive(target)
      const to = new Date()
      const from = new Date(to.getTime() - Number(rangeDays) * 24 * 60 * 60 * 1000)
      const result = await metricsApi.queryDashboard(target.key, {
        from: from.toISOString(),
        to: to.toISOString(),
        compare: compareMode,
      })
      setWidgets(result.widgets)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载指标失败')
    } finally {
      setLoading(false)
    }
  }, [compare, days])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageContainer pageTitle='指标看板' pageDescription='预聚合指标、趋势、对比与导出。'>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>看板</span>
            <Select
              value={active?.key ?? ''}
              onValueChange={(value) => void load(value)}
            >
              <SelectTrigger className='w-48'>
                <SelectValue placeholder='选择看板' />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((dashboard) => (
                  <SelectItem key={dashboard.id} value={dashboard.key}>
                    {dashboard.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>时间</span>
            <Select
              value={days}
              onValueChange={(value) => {
                setDays(value)
                void load(active?.key, compare, value)
              }}
            >
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='7'>近 7 天</SelectItem>
                <SelectItem value='30'>近 30 天</SelectItem>
                <SelectItem value='90'>近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>对比</span>
            <Select
              value={compare}
              onValueChange={(value) => {
                const mode = value as typeof compare
                setCompare(mode)
                void load(active?.key, mode)
              }}
            >
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>不对比</SelectItem>
                <SelectItem value='previous'>上一周期</SelectItem>
                <SelectItem value='year'>同比</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant='outline'
            onClick={() =>
              void metricsApi
                .export({
                  format: 'csv',
                  metricKeys: widgets.map((item) => item.widget.metricKey),
                })
                .then(() => setMessage('导出任务已创建'))
                .catch((error) => setMessage((error as Error).message))
            }
            disabled={widgets.length === 0}
          >
            导出 CSV
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        {loading ? <div className='text-muted-foreground text-sm'>加载中…</div> : null}
        {!loading && !active ? (
          <div className='text-muted-foreground rounded-lg border bg-card p-10 text-center text-sm'>
            还没有看板。
          </div>
        ) : null}

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {widgets.map(({ widget, result }) => (
            <div key={widget.id} className='space-y-2 rounded-lg border bg-card p-4'>
              <div className='flex items-center justify-between'>
                <span className='font-medium'>{widget.metricKey}</span>
                <Badge variant='outline'>{widget.type}</Badge>
              </div>
              <div className='text-2xl font-semibold'>
                {widget.type === 'number'
                  ? result.items.reduce((sum, item) => sum + item.value, 0)
                  : result.items.length}
              </div>
              {result.comparison ? (
                <div className='text-muted-foreground text-xs'>
                  对比 {result.comparison.mode}：{result.comparison.items.length} 个周期
                </div>
              ) : null}
              <div className='space-y-1'>
                {result.items.slice(-7).map((item, index) => (
                  <div key={`${item.periodStart}-${index}`} className='flex items-center gap-2 text-xs'>
                    <span className='text-muted-foreground w-20 truncate'>
                      {new Date(item.periodStart).toLocaleDateString()}
                    </span>
                    <div className='bg-muted h-1.5 flex-1 overflow-hidden rounded'>
                      <div
                        className='bg-primary h-full'
                        style={{
                          width: `${Math.min(100, Math.max(2, (item.value / Math.max(...result.items.map((point) => point.value), 1)) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className='w-12 text-right'>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
