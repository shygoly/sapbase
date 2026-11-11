'use client'

import React from 'react'
import { cn } from './lib/utils'

export interface UsageMeterProps {
  label: string
  used: number
  limit: number | null
  unit?: string
  /** 超过该比例显示警示色；默认 0.8。 */
  warnAt?: number
  className?: string
}

/**
 * 配额/用量提示原语：业务页不得私自实现第二套计量 UI。
 * limit=null 表示不限量。
 */
export function UsageMeter({
  label,
  used,
  limit,
  unit,
  warnAt = 0.8,
  className,
}: UsageMeterProps) {
  const percent = limit && limit > 0 ? Math.min(1, used / limit) : null
  const warning = percent !== null && percent >= warnAt
  return (
    <div className={cn('space-y-1 text-sm', className)} data-usage-meter='true'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-muted-foreground'>{label}</span>
        <span className={warning ? 'font-medium text-amber-600' : 'font-medium'}>
          {used}
          {limit === null ? ' / 不限' : ` / ${limit}`}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      {percent !== null ? (
        <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
          <div
            className={cn('h-full rounded-full', warning ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${Math.round(percent * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
