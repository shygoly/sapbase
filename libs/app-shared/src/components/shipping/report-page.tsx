'use client'

import { useEffect, useState } from 'react'
import PageContainer from '../layout/page-container'
import { ChartCard } from './chart-card'
import { DataTable } from './data-table'
import { DonutChart } from './donut-chart'
import { ExportButton } from './export-button'
import { MetricCard } from './metric-card'
import { SearchFilterBar } from './search-filter-bar'
import { TrendChart } from './trend-chart'
import { shipOptions, years } from '../../lib/api/shipping/mock-data'
import { reportsApi } from '../../lib/api/shipping/reports.api'
import type { ShippingReportPayload, TableColumn } from '../../lib/api/shipping/types'

const tableColumns: TableColumn<Record<string, string>>[] = [
  { key: 'month', header: 'Month' },
  { key: 'attained', header: 'Attained / Actual' },
  { key: 'required', header: 'Required / Target' },
  { key: 'warning', header: 'Compliance Warning' },
  { key: 'emissions', header: 'Emissions', align: 'right' },
  { key: 'euaRequired', header: 'EUA Required', align: 'right' },
  { key: 'ghgDifference', header: 'GHG Difference', align: 'right' },
  { key: 'penalty', header: 'Penalty', align: 'right' },
]

export function ShippingReportPage({
  title,
  description,
  reportKey,
}: {
  title: string
  description: string
  reportKey: 'cii' | 'fueleu' | 'eu-ets' | 'fuel-cost' | 'home-overview' | 'scenario-analysis'
}) {
  const [filters, setFilters] = useState({ shipId: shipOptions[0]?.value ?? '', year: years[1]?.value ?? '2025', keyword: '' })
  const [resolvedData, setResolvedData] = useState<ShippingReportPayload<Record<string, string>> | null>(null)

  useEffect(() => {
    let mounted = true
    reportsApi.getReport(reportKey, filters.shipId, filters.year).then((result) => {
      if (mounted) {
        setResolvedData(result)
      }
    })

    return () => {
      mounted = false
    }
  }, [reportKey, filters.shipId, filters.year])

  const current = resolvedData

  return (
    <PageContainer
      pageTitle={title}
      pageDescription={description}
      pageHeaderAction={<ExportButton reportType={reportKey} vesselId={filters.shipId} year={filters.year} />}
    >
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <SearchFilterBar ships={shipOptions} years={years} value={filters} onChange={setFilters} />
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {current?.metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>
        <div className='grid gap-4 xl:grid-cols-[1.6fr_1fr]'>
          <ChartCard title='Performance Trend' description='Actual vs target / forecast over time'>
            {current ? <TrendChart data={current.trend} /> : null}
          </ChartCard>
          <ChartCard title='Composition' description='Cost / compliance allocation'>
            {current?.donut ? <DonutChart data={current.donut} /> : null}
          </ChartCard>
        </div>
        <ChartCard title='Monthly Detail' description='Unified detail table aligned with demo dashboards'>
          {current ? <DataTable columns={tableColumns} rows={current.rows.filter((row) => {
            if (!filters.keyword) return true
            const q = filters.keyword.toLowerCase()
            return Object.values(row).some((value) => value.toLowerCase().includes(q))
          })} /> : null}
        </ChartCard>
      </div>
    </PageContainer>
  )
}
