'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { DonutPoint } from '@/lib/api/shipping/types'

export function DonutChart({ data }: { data: DonutPoint[] }) {
  const config = Object.fromEntries(data.map((item) => [item.name, { label: item.name, color: item.color }]))

  return (
    <div className='grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]'>
      <ChartContainer className='mx-auto h-[220px] max-w-[220px]' config={config}>
        <PieChart>
          <Pie data={data} dataKey='value' innerRadius={55} outerRadius={80} paddingAngle={3}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        </PieChart>
      </ChartContainer>
      <div className='grid content-center gap-3'>
        {data.map((entry) => (
          <div key={entry.name} className='flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3'>
            <div className='flex items-center gap-3'>
              <span className='h-3 w-3 rounded-full' style={{ backgroundColor: entry.color }} />
              <span className='text-sm font-medium text-slate-700'>{entry.name}</span>
            </div>
            <span className='text-sm font-semibold text-slate-950'>{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
