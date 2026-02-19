'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { WorkflowInstance } from '@/lib/api/workflows.api'
import { workflowsApi } from '@/lib/api/workflows.api'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface WorkflowTransitionButtonsProps {
  instance: WorkflowInstance
  availableTransitions: Array<{
    transition: {
      from: string
      to: string
      guard?: string
      action?: string
    }
    guardPassed: boolean
    guardError?: string
  }>
  onTransition?: () => void
  disabled?: boolean
}

export function WorkflowTransitionButtons({
  instance,
  availableTransitions,
  onTransition,
  disabled = false,
}: WorkflowTransitionButtonsProps) {
  const [transitioning, setTransitioning] = useState<string | null>(null)

  const handleTransition = async (toState: string) => {
    if (transitioning) return

    try {
      setTransitioning(toState)
      await workflowsApi.executeTransition(instance.id, {
        toState,
        entity: {}, // Could pass entity data here
      })
      toast.success(`Transitioned to "${toState}"`)
      if (onTransition) {
        onTransition()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute transition')
    } finally {
      setTransitioning(null)
    }
  }

  if (availableTransitions.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No available transitions from current state
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {availableTransitions.map((item, index) => {
        const { transition, guardPassed, guardError } = item
        const isTransitioning = transitioning === transition.to
        const isDisabled = disabled || isTransitioning || !guardPassed

        const button = (
          <Button
            key={index}
            variant={guardPassed ? 'default' : 'outline'}
            onClick={() => handleTransition(transition.to)}
            disabled={isDisabled}
          >
            {isTransitioning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transitioning...
              </>
            ) : (
              <>
                {transition.from} → {transition.to}
              </>
            )}
          </Button>
        )

        if (!guardPassed && guardError) {
          return (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{guardError}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        return button
      })}
    </div>
  )
}
