'use client'

import React from 'react'
import { Badge } from './ui/badge'

export function AiContentBadge({
  label,
  compact = false,
}: {
  label?: string | null
  compact?: boolean
}) {
  return (
    <Badge variant='outline' title='AI 生成内容，请核对来源与人工终审状态'>
      {compact ? 'AI' : label || 'AI 生成'}
    </Badge>
  )
}
