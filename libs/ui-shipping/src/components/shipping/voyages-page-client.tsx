'use client'

import { useEffect, useState } from 'react'
import PageContainer from '@sap/ui-runtime/layout/page-container'
import { ChartCard } from './chart-card'
import { DataTable } from './data-table'
import { ImportDialog } from './import-dialog'
import { RowActions } from './row-actions'
import { StatusSwitchCell } from './status-switch-cell'
import { voyagesApi } from '@sap/api-client/api/shipping/voyages.api'
import type { VoyageRecord } from '@sap/api-client/api/shipping/types'

export function VoyagesPageClient() {
  const [rows, setRows] = useState<VoyageRecord[]>([])

  const loadRows = async () => {
    const nextRows = await voyagesApi.findAll()
    setRows(nextRows)
  }

  useEffect(() => {
    loadRows()
  }, [])

  return (
    <PageContainer
      pageTitle='Voyage Management'
      pageDescription='Import and reconcile voyage records with through-ice visibility and charter status.'
      pageHeaderAction={<ImportDialog onImported={loadRows} />}
    >
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Workflow</p>
            <h3 className='mt-3 text-xl font-semibold text-slate-950'>Voyage import & reconciliation</h3>
            <p className='mt-2 text-sm text-slate-500'>Upload the standard xlsx template and review row-level success / failure feedback.</p>
          </div>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Validation</p>
            <h3 className='mt-3 text-xl font-semibold text-slate-950'>Claimed vs unclaimed</h3>
            <p className='mt-2 text-sm text-slate-500'>Rows with exactly one matching charter become CLAIMED; unmatched rows remain UNCLAIMED.</p>
          </div>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Actions</p>
            <div className='mt-3 flex items-center justify-between text-sm text-slate-600'>
              <span>Realtime sync</span>
              <StatusSwitchCell />
            </div>
          </div>
        </div>
        <ChartCard title='Voyage Records' description='Latest imported rows for the current organization'>
          <DataTable
            columns={[
              { key: 'voyageNo', header: 'Voyage No.' },
              { key: 'vesselName', header: 'Vessel' },
              { key: 'departurePort', header: 'Departure' },
              { key: 'arrivalPort', header: 'Arrival' },
              { key: 'distanceNm', header: 'Distance (NM)', align: 'right' },
              { key: 'throughIce', header: 'Through Ice' },
              { key: 'status', header: 'Status' },
              { key: '__actions__', header: 'Actions', align: 'right', render: () => <RowActions /> },
            ]}
            rows={rows}
          />
        </ChartCard>
      </div>
    </PageContainer>
  )
}
