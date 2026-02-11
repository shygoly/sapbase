'use client'

import { MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export interface RowAction {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface DataTableRowActionsProps {
  actions: RowAction[]
  isLoading?: boolean
}

const defaultIcons: Record<string, React.ReactNode> = {
  edit: <Edit className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  view: <Eye className="h-4 w-4" />,
}

export function DataTableRowActions({
  actions,
  isLoading = false,
}: DataTableRowActionsProps) {
  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          disabled={isLoading}
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <div key={action.id}>
            <DropdownMenuItem
              onClick={action.onClick}
              disabled={action.disabled || isLoading}
              className={action.variant === 'destructive' ? 'text-destructive' : ''}
            >
              {action.icon || defaultIcons[action.id]}
              <span className="ml-2">{action.label}</span>
            </DropdownMenuItem>
            {index < actions.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
