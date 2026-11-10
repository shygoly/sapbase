'use client'

import PageContainer from '@sap/app-shared/components/layout/page-container'
import React, { useEffect, useState } from 'react'
import { dashboardApi, type DashboardSummary } from '@sap/api-client'

export default function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode
  pie_stats: React.ReactNode
  bar_stats: React.ReactNode
  area_stats: React.ReactNode
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi
      .summary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [])

  const metric = (value: number | undefined) => (loading ? '—' : String(value ?? 0))

  const metrics = [
    { label: 'Users', value: summary?.users, hint: 'Organization members' },
    { label: 'Roles', value: summary?.roles, hint: 'Role definitions' },
    { label: 'App installations', value: summary?.appInstallations, hint: 'Installed apps' },
    { label: 'Pending proposals', value: summary?.pendingProposals, hint: 'Awaiting review' }
  ]

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col'>
        <header className='flex items-end justify-between gap-4 pb-6'>
          <div>
            <h1 className='font-serif text-[26px] leading-tight font-semibold tracking-[-0.015em]'>
              Overview
            </h1>
            <p className='mt-1 text-[13px] text-muted-foreground'>
              Organization health at a glance.
            </p>
          </div>
          <p className='hidden text-[11px] text-muted-foreground md:block'>
            {summary ? `${summary.releases} releases · ${summary.feedback7d} feedback (7d)` : null}
          </p>
        </header>

        {/* 账目条：四格共用一条外框，内部 1px 线分隔 */}
        <div className='bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border md:grid-cols-2 lg:grid-cols-4'>
          {metrics.map((item) => (
            <div key={item.label} className='bg-card px-5 py-5'>
              <p className='text-[12px] text-muted-foreground'>{item.label}</p>
              <p className='mt-2 font-serif text-[30px] leading-none font-semibold tabular-nums tracking-[-0.02em]'>
                {metric(item.value)}
              </p>
              <p className='mt-2 text-[11px] text-muted-foreground'>{item.hint}</p>
            </div>
          ))}
        </div>

        <div className='mt-6 grid grid-cols-1 gap-6 lg:grid-cols-7'>
          <div className='lg:col-span-4'>{bar_stats}</div>
          <div className='lg:col-span-3'>{sales}</div>
          <div className='lg:col-span-4'>{area_stats}</div>
          <div className='lg:col-span-3'>{pie_stats}</div>
        </div>
      </div>
    </PageContainer>
  )
}
