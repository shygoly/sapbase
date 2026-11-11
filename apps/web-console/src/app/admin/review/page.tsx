'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { reviewApi, type ReviewOverview, type ReviewStep } from '@sap/api-client'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'

const pageModel: PageModel = {
  id: 'review-admin',
  title: '复核与审批',
  description: '步骤类型 / selector / SLA / 机器检测 / 待办对账',
  permissions: ['review:read'],
}

export default function ReviewAdminPage() {
  const [overview, setOverview] = useState<ReviewOverview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOverview(await reviewApi.overview())
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reconcile = async () => {
    try {
      const result = await reviewApi.reconcile()
      setMessage(
        `对账完成：扫描 ${result.scanned}，重解析 ${result.reassigned}，阻塞 ${result.blocked}，投影 ${result.projected}，关闭 ${result.closed}`,
      )
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button onClick={() => void load()} disabled={loading}>
            刷新
          </Button>
          <Button variant='outline' onClick={() => void reconcile()}>
            重建待办 / 重解析审批人
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        {overview ? (
          <>
            <div className='grid gap-4 md:grid-cols-4'>
              <Metric title='待处理步骤' value={overview.pending} />
              <Metric title='已超时' value={overview.overdue} tone='urgent' />
              <Metric title='已升级' value={overview.escalated} />
              <Metric title='机器检测步骤' value={overview.checkSteps} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>运行配置</CardTitle>
                <CardDescription>步骤、selector、SLA 与机器检测</CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3 text-sm md:grid-cols-2'>
                <div>
                  <div className='text-muted-foreground text-xs'>审批人 selector</div>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {overview.selectors.map((item) => (
                      <Badge key={item} variant='outline'>
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>机器检测 provider</div>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {overview.checkProviders.length > 0 ? (
                      overview.checkProviders.map((item) => (
                        <Badge key={item} variant='secondary'>
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className='text-muted-foreground'>未注册 provider（fail-closed）</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>SLA 扫描</div>
                  <div className='mt-1'>每 10 分钟；到期前 {overview.sla.remindBeforeHours} 小时提醒</div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>升级策略</div>
                  <div className='mt-1'>超时通知角色/Admin 兜底；不自动通过</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>待处理步骤</CardTitle>
                <CardDescription>按截止时间排序；点击进入待办中心处理</CardDescription>
              </CardHeader>
              <CardContent>
                <StepTable rows={overview.items} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PageRuntime>
  )
}

function Metric({
  title,
  value,
  tone,
}: {
  title: string
  value: number
  tone?: 'urgent'
}) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='text-muted-foreground text-xs'>{title}</div>
      <div className={tone === 'urgent' ? 'text-destructive text-2xl font-semibold' : 'text-2xl font-semibold'}>
        {value}
      </div>
    </div>
  )
}

function StepTable({ rows }: { rows: ReviewStep[] }) {
  if (rows.length === 0) {
    return <div className='text-muted-foreground text-sm'>没有待处理步骤。</div>
  }
  return (
    <div className='overflow-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='text-muted-foreground border-b text-left text-xs'>
            <th className='py-2'>实体/记录</th>
            <th className='py-2'>规则</th>
            <th className='py-2'>轮次/步骤</th>
            <th className='py-2'>类型</th>
            <th className='py-2'>角色/Selector</th>
            <th className='py-2'>SLA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className='border-b last:border-b-0'>
              <td className='py-2'>
                {row.entity}:{row.recordId.slice(0, 8)}
              </td>
              <td className='py-2'>{row.ruleId}</td>
              <td className='py-2'>
                {row.round}/{row.stepIndex + 1}
              </td>
              <td className='py-2'>
                <Badge variant={row.kind === 'check' ? 'secondary' : 'outline'}>{row.kind}</Badge>
              </td>
              <td className='py-2'>
                {row.role || '—'}
                {row.selector ? (
                  <span className='text-muted-foreground ml-1 text-xs'>
                    {JSON.stringify(row.selector)}
                  </span>
                ) : null}
              </td>
              <td className='py-2'>
                {row.dueAt ? (
                  <span
                    className={
                      new Date(row.dueAt).getTime() < Date.now() ? 'text-destructive' : ''
                    }
                  >
                    {new Date(row.dueAt).toLocaleString()}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
