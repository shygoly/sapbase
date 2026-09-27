'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { ShippingOption } from '@/lib/api/shipping/types'

interface ShippingFilters {
  shipId: string
  year: string
  keyword: string
}

export function SearchFilterBar({
  ships,
  years,
  value,
  onChange,
}: {
  ships: ShippingOption[]
  years: ShippingOption[]
  value: ShippingFilters
  onChange: (nextValue: ShippingFilters) => void
}) {
  return (
    <div className='grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.2fr_180px_1fr]'>
      <Select value={value.shipId} onValueChange={(shipId) => onChange({ ...value, shipId })}>
        <SelectTrigger className='h-11 border-slate-200 bg-slate-50'>
          <SelectValue placeholder='Select vessel' />
        </SelectTrigger>
        <SelectContent>
          {ships.map((ship) => (
            <SelectItem key={ship.value} value={ship.value}>{ship.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.year} onValueChange={(year) => onChange({ ...value, year })}>
        <SelectTrigger className='h-11 border-slate-200 bg-slate-50'>
          <SelectValue placeholder='Year' />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value.keyword ?? ''}
        onChange={(event) => onChange({ ...value, keyword: event.target.value })}
        placeholder='Search port / voyage / report'
        className='h-11 border-slate-200 bg-slate-50'
      />
    </div>
  )
}
