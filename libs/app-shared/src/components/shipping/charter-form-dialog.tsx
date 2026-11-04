'use client'

import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { chartersApi, type CharterMutationInput } from '../../lib/api/shipping/charters.api'
import { shipsApi } from '../../lib/api/shipping/ships.api'
import type { CharterRecord, ShipRecord } from '../../lib/api/shipping/types'
import { useNotification } from '../../core/ui/ui-hooks'

const initialForm: CharterMutationInput = {
  shipId: '',
  charterer: '',
  startDate: '',
  endDate: '',
  status: 'PENDING',
  allocation: '',
}

export function CharterFormDialog({
  open,
  onOpenChange,
  charter,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  charter?: (CharterRecord & { shipId?: string }) | null
  onSuccess?: () => void
}) {
  const [form, setForm] = useState<CharterMutationInput>(initialForm)
  const [ships, setShips] = useState<ShipRecord[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const notification = useNotification()

  useEffect(() => {
    shipsApi.findAll().then(setShips)
  }, [])

  useEffect(() => {
    if (!charter) {
      setForm(initialForm)
      return
    }

    const matchedShip = ships.find((ship) => ship.name === charter.vesselName)
    setForm({
      shipId: charter.shipId || matchedShip?.id || '',
      charterer: charter.charterer,
      startDate: charter.startDate,
      endDate: charter.endDate,
      status: charter.status,
      allocation: charter.allocation,
    })
  }, [charter, open, ships])

  const submit = async () => {
    setIsSubmitting(true)
    try {
      if (charter?.id) {
        await chartersApi.update(charter.id, form)
        notification.success('Charter updated successfully')
      } else {
        await chartersApi.create(form)
        notification.success('Charter created successfully')
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      notification.error(error instanceof Error ? error.message : 'Charter save failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{charter ? 'Edit Charter' : 'Create Charter'}</DialogTitle>
          <DialogDescription>Maintain non-overlapping charter periods by vessel.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <Select value={form.shipId} onValueChange={(shipId: string) => setForm({ ...form, shipId })}>
            <SelectTrigger><SelectValue placeholder='Select vessel' /></SelectTrigger>
            <SelectContent>
              {ships.map((ship) => <SelectItem key={ship.id} value={ship.id}>{ship.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder='Charterer' value={form.charterer} onChange={(e) => setForm({ ...form, charterer: e.target.value })} />
          <div className='grid gap-4 md:grid-cols-2'>
            <Input type='date' value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input type='date' value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <Input placeholder='Status' value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })} />
            <Input placeholder='Allocation' value={form.allocation || ''} onChange={(e) => setForm({ ...form, allocation: e.target.value })} />
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
