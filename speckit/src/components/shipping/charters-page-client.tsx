'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ChartCard } from './chart-card'
import { DataTable } from './data-table'
import { CharterFormDialog } from './charter-form-dialog'
import { chartersApi } from '@/lib/api/shipping/charters.api'
import type { CharterRecord } from '@/lib/api/shipping/types'
import { useNotification } from '@/core/ui/ui-hooks'

export function ChartersPageClient() {
  const [rows, setRows] = useState<CharterRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CharterRecord | null>(null)
  const [deleting, setDeleting] = useState<CharterRecord | null>(null)
  const notification = useNotification()

  const loadRows = async () => setRows(await chartersApi.findAll())

  useEffect(() => {
    loadRows()
  }, [])

  const remove = async () => {
    if (!deleting) return
    try {
      await chartersApi.delete(deleting.id)
      notification.success('Charter deleted successfully')
      setDeleting(null)
      await loadRows()
    } catch (error) {
      notification.error(error instanceof Error ? error.message : 'Charter delete failed')
    }
  }

  return (
    <PageContainer
      pageTitle='Contract Management'
      pageDescription='Manage charter periods, charterers and time charter allocation.'
      pageHeaderAction={<Button className='bg-[#1677ff] text-white hover:bg-[#0958d9]' onClick={() => { setEditing(null); setOpen(true) }}><Plus className='mr-2 h-4 w-4' />Create Charter</Button>}
    >
      <div className='space-y-5 bg-[#f5f7fb] pb-6'>
        <ChartCard title='Charter Periods' description='The backend blocks overlapping charter periods for the same vessel'>
          <DataTable
            columns={[
              { key: 'vesselName', header: 'Vessel' },
              { key: 'charterer', header: 'Charterer' },
              { key: 'startDate', header: 'Start Date' },
              { key: 'endDate', header: 'End Date' },
              { key: 'status', header: 'Status' },
              { key: 'allocation', header: 'Allocation' },
              { key: '__actions__', header: 'Actions', align: 'right', render: (row) => <div className='flex justify-end gap-2'><Button variant='outline' size='sm' onClick={() => { setEditing(row); setOpen(true) }}>Edit</Button><Button size='sm' className='bg-rose-600 text-white hover:bg-rose-700' onClick={() => setDeleting(row)}>Delete</Button></div> },
            ]}
            rows={rows}
          />
        </ChartCard>
      </div>
      <CharterFormDialog open={open} onOpenChange={setOpen} charter={editing} onSuccess={loadRows} />
      <ConfirmDialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)} onConfirm={remove} title='Delete Charter' description='Delete this charter period?' confirmText='Delete' cancelText='Cancel' variant='danger' />
    </PageContainer>
  )
}
