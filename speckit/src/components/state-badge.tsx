'use client'

import { Badge } from '@/components/ui/badge'

interface StateBadgeProps {
  state: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
}

const stateColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-200 text-gray-600',
}

export function StateBadge({ state, variant = 'default', className }: StateBadgeProps) {
  const colorClass = stateColors[state] || 'bg-gray-100 text-gray-800'

  return (
    <Badge variant={variant} className={`${colorClass} ${className || ''}`}>
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </Badge>
  )
}
