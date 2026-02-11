'use client'

import { Trash2, Download, Edit2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface BatchAction {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface EnhancedBatchOperationsProps {
  selectedCount: number
  totalCount: number
  actions?: BatchAction[]
  onClearSelection: () => void
  isLoading?: boolean
  className?: string
}

const defaultActions: Record<string, React.ReactNode> = {
  delete: <Trash2 className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  edit: <Edit2 className="h-4 w-4" />,
}

export function EnhancedBatchOperations({
  selectedCount,
  totalCount,
  actions = [],
  onClearSelection,
  isLoading = false,
  className,
}: EnhancedBatchOperationsProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} of {totalCount} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isLoading}
          className="h-6 px-2"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
            onClick={action.onClick}
            disabled={action.disabled || isLoading}
            className="gap-2"
          >
            {action.icon || defaultActions[action.id]}
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
