'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import PageContainer from '../layout/page-container'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { ChartCard } from './chart-card'
import { DataTable } from './data-table'
import { ShipFormDialog } from './ship-form-dialog'
import { shipsApi } from '../../lib/api/shipping/ships.api'
import type { ShipRecord } from '../../lib/api/shipping/types'
import { useNotification } from '../../core/ui/ui-hooks'

export function ShipsPageClient() {
  const [rows, setRows] = useState<ShipRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShipRecord | null>(null)
  const [deleting, setDeleting] = useState<ShipRecord | null>(null)
  const notification = useNotification()

  const loadRows = async () => setRows(await shipsApi.findAll())

  useEffect(() => {
    loadRows()
  }, [])

  const remove = async () => {
    if (!deleting) return
    try {
      await shipsApi.delete(deleting.id)
      notification.success('Ship deleted successfully')
      setDeleting(null)
      await loadRows()
    } catch (error) {
      notification.error(error instanceof Error ? error.message : 'Ship delete failed')
    }
  }

  return (
    <PageContainer
      pageTitle='Vessel Management'
      pageDescription='Manage vessel basic information, technical parameters and CII readiness.'
      pageHeaderAction={<Button className='bg-[#1677ff] text-white hover:bg-[#0958d9]' onClick={() => { setEditing(null); setOpen(true) }}><Plus className='mr-2 h-4 w-4' />Create Vessel</Button>}
    >
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <ChartCard title='Vessel Master Data' description='Tenant-scoped ship records used by chartering, voyages and reports'>
          <DataTable
            columns={[
              { key: 'name', header: 'Vessel' },
              { key: 'imo', header: 'IMO' },
              { key: 'type', header: 'Type' },
              { key: 'ciiRating', header: 'CII Rating' },
              { key: 'dwt', header: 'DWT', align: 'right' },
              { key: 'speed', header: 'Cruise Speed', align: 'right' },
              { key: '__actions__', header: 'Actions', align: 'right', render: (row) => <div className='flex justify-end gap-2'><Button variant='outline' size='sm' onClick={() => { setEditing(row); setOpen(true) }}>Edit</Button><Button size='sm' className='bg-rose-600 text-white hover:bg-rose-700' onClick={() => setDeleting(row)}>Delete</Button></div> },
            ]}
            rows={rows}
          />
        </ChartCard>
      </div>
      <ShipFormDialog open={open} onOpenChange={setOpen} ship={editing} onSuccess={loadRows} />
      <ConfirmDialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)} onConfirm={remove} title='Delete Vessel' description='Delete this vessel and its downstream shipping records?' confirmText='Delete' cancelText='Cancel' variant='danger' />
    </PageContainer>
  )
}
