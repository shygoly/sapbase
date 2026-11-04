import PageContainer from '../layout/page-container'
import { ChartCard } from './chart-card'
import { DataTable } from './data-table'
import { RowActions } from './row-actions'
import { StatusSwitchCell } from './status-switch-cell'
import type { TableColumn } from '../../lib/api/shipping/types'

export function MasterDataPage<T extends object>({
  title,
  description,
  rows,
  columns,
}: {
  title: string
  description: string
  rows: T[]
  columns: TableColumn<T>[]
}) {
  return (
    <PageContainer pageTitle={title} pageDescription={description}>
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Workflow</p>
            <h3 className='mt-3 text-xl font-semibold text-slate-950'>Data Ocean shipping workspace</h3>
            <p className='mt-2 text-sm text-slate-500'>Maintain vessels, charter periods and voyage imports with one consistent navigation model.</p>
          </div>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Validation</p>
            <h3 className='mt-3 text-xl font-semibold text-slate-950'>Tenant-isolated records</h3>
            <p className='mt-2 text-sm text-slate-500'>Supports claimed / unclaimed status, through-ice visibility and export traceability.</p>
          </div>
          <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>Actions</p>
            <div className='mt-3 flex items-center justify-between text-sm text-slate-600'>
              <span>Realtime sync</span>
              <StatusSwitchCell />
            </div>
          </div>
        </div>
        <ChartCard title={title} description={description}>
          <DataTable columns={[...columns, { key: '__actions__', header: 'Actions', align: 'right', render: () => <RowActions /> }]} rows={rows} />
        </ChartCard>
      </div>
    </PageContainer>
  )
}
