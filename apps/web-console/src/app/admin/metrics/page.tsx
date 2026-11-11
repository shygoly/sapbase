'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  metricsApi,
  type MetricAlert,
  type MetricDefinition,
} from '@sap/api-client'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'

const pageModel: PageModel = {
  id: 'metrics-admin',
  title: '指标与预警',
  description: '指标定义 / 快照 / 回填 / 预警 / 看板',
  permissions: ['metrics:read'],
}

export default function MetricsAdminPage() {
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([])
  const [alerts, setAlerts] = useState<MetricAlert[]>([])
  const [key, setKey] = useState('active.students')
  const [name, setName] = useState('活跃学生数')
  const [entity, setEntity] = useState('Student')
  const [alertMetric, setAlertMetric] = useState('')
  const [threshold, setThreshold] = useState('5')
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setDefinitions(await metricsApi.definitions())
      setAlerts(await metricsApi.alerts())
      setEvents(await metricsApi.alertEvents(20))
    } catch (error) {
      setMessage((error as Error).message || '加载失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      setMessage(success)
      await load()
    } catch (error) {
      setMessage((error as Error).message || '操作失败')
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <div className='space-y-4'>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={() => void run(() => metricsApi.snapshot(), '快照已生成')}>
            生成日快照
          </Button>
          <Button
            variant='outline'
            onClick={() => void run(() => metricsApi.backfill({ days: 30 }), '回填完成')}
          >
            回填 30 天
          </Button>
          <Button
            variant='outline'
            onClick={() => void run(() => metricsApi.evaluateAlerts(), '预警已评估')}
          >
            评估预警
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>注册指标</CardTitle>
            <CardDescription>受控来源：blueprint / platform / event / computed</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='flex flex-wrap gap-2'>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder='key' />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='名称' />
              <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder='实体' />
              <Button
                onClick={() =>
                  void run(
                    () =>
                      metricsApi.createDefinition({
                        key,
                        name,
                        period: 'day',
                        aggregation: 'count',
                        sourceType: 'blueprint',
                        sourceConfig: { entity },
                        dimensions: [],
                        permissions: ['metrics:read'],
                      }),
                    '指标已注册',
                  )
                }
              >
                注册
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {definitions.map((definition) => (
                <Badge key={`${definition.key}-${definition.version}`} variant='outline'>
                  {definition.key} v{definition.version} · {definition.aggregation}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>预警</CardTitle>
            <CardDescription>阈值/窗口/冷却；触发与恢复写事件</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='flex flex-wrap gap-2'>
              <Input
                value={alertMetric}
                onChange={(e) => setAlertMetric(e.target.value)}
                placeholder='metricKey'
              />
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder='阈值'
              />
              <Button
                onClick={() =>
                  void run(
                    () =>
                      metricsApi.createAlert({
                        key: `alert-${Date.now()}`,
                        metricKey: alertMetric,
                        operator: 'lt',
                        threshold: String(threshold),
                        windowMinutes: 30,
                        cooldownMinutes: 60,
                        channels: ['inbox'],
                      }),
                    '预警已创建',
                  )
                }
              >
                创建预警
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {alerts.map((alert) => (
                <Badge key={alert.id} variant='secondary'>
                  {alert.metricKey} {alert.operator} {alert.threshold ?? '—'}
                </Badge>
              ))}
            </div>
            <div className='text-muted-foreground space-y-1 text-xs'>
              {events.map((event) => (
                <div key={String(event.id)}>
                  {String(event.state)} · {String(event.value)} · {String(event.createdAt)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageRuntime>
  )
}
