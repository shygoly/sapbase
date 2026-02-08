'use client'

import { Button } from '@/components/ui/button'

interface StateActionsProps {
  availableTransitions: string[]
  onTransition: (event: string) => void
  isLoading?: boolean
}

export function StateActions({
  availableTransitions,
  onTransition,
  isLoading = false,
}: StateActionsProps) {
  if (availableTransitions.length === 0) {
    return <div className="text-sm text-gray-500">No actions available</div>
  }

  return (
    <div className="flex gap-2">
      {availableTransitions.map(event => (
        <Button
          key={event}
          onClick={() => onTransition(event)}
          disabled={isLoading}
          variant="outline"
        >
          {event.charAt(0).toUpperCase() + event.slice(1)}
        </Button>
      ))}
    </div>
  )
}
