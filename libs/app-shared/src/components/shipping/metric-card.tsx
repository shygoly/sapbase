import { Card, CardContent } from '../ui/card'
import { cn } from '../../lib/utils'
import type { MetricCardValue } from '../../lib/api/shipping/types'

const toneMap = {
  default: 'text-slate-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
}

export function MetricCard({ label, value, trend, tone = 'default' }: MetricCardValue) {
  return (
    <Card className='gap-2 border-slate-200 bg-white py-4 shadow-sm'>
      <CardContent className='space-y-2 px-5'>
        <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-500'>{label}</p>
        <div className='text-3xl font-semibold tracking-tight text-slate-950'>{value}</div>
        {trend ? <p className={cn('text-sm font-medium', toneMap[tone])}>{trend}</p> : null}
      </CardContent>
    </Card>
  )
}
