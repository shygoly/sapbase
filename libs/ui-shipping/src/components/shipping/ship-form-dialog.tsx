'use client'

import { useEffect, useState } from 'react'
import { Button } from '@sap/ui-kit/button'
import { Input } from '@sap/ui-kit/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sap/ui-kit/dialog'
import { shipsApi, type ShipMutationInput } from '@sap/api-client/api/shipping/ships.api'
import type { ShipRecord } from '@sap/api-client/api/shipping/types'
import { useNotification } from '@sap/ui-layout/core/ui/ui-hooks'

const initialForm: ShipMutationInput = {
  name: '',
  imo: '',
  type: '',
  status: 'ACTIVE',
  ciiRating: 'C',
  dwt: 0,
  speed: 0,
}

export function ShipFormDialog({
  open,
  onOpenChange,
  ship,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ship?: ShipRecord | null
  onSuccess?: () => void
}) {
  const [form, setForm] = useState<ShipMutationInput>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const notification = useNotification()

  useEffect(() => {
    if (!ship) {
      setForm(initialForm)
      return
    }

    setForm({
      name: ship.name,
      imo: ship.imo ?? '',
      type: ship.type ?? '',
      status: ship.status ?? '',
      ciiRating: ship.ciiRating || ship.rating,
      dwt: ship.dwt,
      speed: ship.speed,
    })
  }, [ship, open])

  const submit = async () => {
    setIsSubmitting(true)
    try {
      if (ship?.id) {
        await shipsApi.update(ship.id, form)
        notification.success('Ship updated successfully')
      } else {
        await shipsApi.create(form)
        notification.success('Ship created successfully')
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      notification.error(error instanceof Error ? error.message : 'Ship save failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ship ? 'Edit Vessel' : 'Create Vessel'}</DialogTitle>
          <DialogDescription>Maintain vessel master data for shipping carbon calculations.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <Input placeholder='Vessel Name' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder='IMO' value={form.imo} onChange={(e) => setForm({ ...form, imo: e.target.value })} />
          <Input placeholder='Type' value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <div className='grid gap-4 md:grid-cols-2'>
            <Input placeholder='CII Rating' value={form.ciiRating || ''} onChange={(e) => setForm({ ...form, ciiRating: e.target.value })} />
            <Input placeholder='Status' value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })} />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <Input type='number' placeholder='DWT' value={String(form.dwt ?? 0)} onChange={(e) => setForm({ ...form, dwt: Number(e.target.value) })} />
            <Input type='number' placeholder='Speed' value={String(form.speed ?? 0)} onChange={(e) => setForm({ ...form, speed: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className='bg-[#1677ff] text-white hover:bg-[#0958d9]' onClick={submit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
