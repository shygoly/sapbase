'use client'

import { useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { ChartCard } from '@sap/app-shared/components/shipping/chart-card'
import { DataTable } from '@sap/app-shared/components/shipping/data-table'
import { SearchFilterBar } from '@sap/app-shared/components/shipping/search-filter-bar'
import { Button } from '@sap/app-shared/components/ui/button'
import { shipOptions, years } from '@sap/app-shared/lib/api/shipping/mock-data'
import { reportCenterApi } from '@sap/app-shared/lib/api/shipping/report-center.api'
import type { ReportCenterRecord } from '@sap/app-shared/lib/api/shipping/types'

export default function ReportCenterPage() {
  const [filters, setFilters] = useState({
    shipId: shipOptions[0]?.value ?? '',
    year: years[1]?.value ?? '2025',
    keyword: '',
  })
  const [rows, setRows] = useState<ReportCenterRecord[]>([])

  useEffect(() => {
    let mounted = true

    reportCenterApi
      .findAll({
        vesselId: filters.shipId,
        year: filters.year,
      })
      .then((result) => {
        if (mounted) {
          setRows(result)
        }
      })

    return () => {
      mounted = false
    }
  }, [filters.shipId, filters.year])

  const filteredRows = rows.filter((row) => {
    if (
      filters.keyword &&
      !`${row.reportType} ${row.vesselName} ${row.fileName}`
        .toLowerCase()
        .includes(filters.keyword.toLowerCase())
    ) {
      return false
    }
    if (filters.year && String(row.year) !== filters.year) {
      return false
    }
    return true
  })

  return (
    <PageContainer
      pageTitle='Report Center'
      pageDescription='Archived exports with vessel, year and report type traceability.'
    >
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <SearchFilterBar
          ships={shipOptions}
          years={years}
          value={filters}
          onChange={setFilters}
        />
        <ChartCard
          title='Historical Report Archive'
          description='Dual-write export records for repeat download and audit'
        >
          <DataTable
            columns={[
              { key: 'reportType', header: 'Report Type' },
              { key: 'vesselName', header: 'Vessel' },
              { key: 'year', header: 'Year', align: 'right' },
              { key: 'exportedAt', header: 'Exported At' },
              { key: 'exportedBy', header: 'Exported By' },
              { key: 'parameters', header: 'Parameters' },
              { key: 'fileName', header: 'File Name' },
              {
                key: 'download',
                header: 'Download',
                render: (row) =>
                  row.downloadUrl ? (
                    <Button
                      size='sm'
                      className='bg-[#1677ff] text-white hover:bg-[#0958d9]'
                      onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051'}${row.downloadUrl}`, '_blank')}
                    >
                      Download
                    </Button>
                  ) : '--',
              },
            ]}
            rows={filteredRows}
          />
        </ChartCard>
      </div>
    </PageContainer>
  )
}
