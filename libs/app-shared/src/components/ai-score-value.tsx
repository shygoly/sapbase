'use client'

import React from 'react'
import { Badge } from './ui/badge'

export function AiScoreValue({
  aiScore,
  humanScore,
  status,
}: {
  aiScore: string | number | null | undefined
  humanScore?: string | number | null
  status: 'ai_only' | 'teacher_confirmed' | 'appealed' | 'final'
}) {
  return (
    <span className='inline-flex items-center gap-2'>
      <span>
        AI 参考分：<strong>{aiScore ?? '—'}</strong>
      </span>
      <span>
        教师评分：<strong>{humanScore ?? '—'}</strong>
      </span>
      <Badge variant={status === 'final' ? 'default' : 'outline'}>
        {status === 'final' ? '正式' : '未终审'}
      </Badge>
    </span>
  )
}
