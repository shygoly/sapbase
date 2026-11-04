'use client'

import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart'
import type { TrendPoint } from '../../lib/api/shipping/types'

const config = {
  actual: { label: 'Actual', color: '#0f766e' },
  target: { label: 'Target', color: '#0ea5e9' },
  forecast: { label: 'Forecast', color: '#f59e0b' },
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer className='h-[280px] w-full' config={config}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
        <CartesianGrid strokeDasharray='3 3' vertical={false} />
        <XAxis dataKey='month' tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={42} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Line type='monotone' dataKey='actual' stroke='var(--color-actual)' strokeWidth={3} dot={false} />
        <Line type='monotone' dataKey='target' stroke='var(--color-target)' strokeWidth={2} strokeDasharray='4 4' dot={false} />
        <Line type='monotone' dataKey='forecast' stroke='var(--color-forecast)' strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
