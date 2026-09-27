'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { blueprintsApi, SuggestedTransition } from '@/lib/api/blueprints.api'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'

interface WorkflowTransitionButtonsProps {
  packageId: string
  entity: string
  recordId: string
  version?: number
  suggestions: SuggestedTransition[]
  onTransition?: () => void
  disabled?: boolean
}

export function WorkflowTransitionButtons({
  packageId,
  entity,
  recordId,
  version,
  suggestions,
  onTransition,
  disabled = false,
}: WorkflowTransitionButtonsProps) {
  const t = useTranslation()
  const [transitioning, setTransitioning] = useState<string | null>(null)

  const handleTransition = async (to: string) => {
    if (transitioning) return

    try {
      setTransitioning(to)
      await blueprintsApi.executeTransition(packageId, entity, recordId, {
        to,
        expectedVersion: version,
      })
      toast.success(t('workflows.transitionSuccess', { to }))
      if (onTransition) {
        onTransition()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('workflows.transitionFailed')
      toast.error(message)
    } finally {
      setTransitioning(null)
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        {t('workflows.noAvailableTransitions')}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((item) => {
        const isTransitioning = transitioning === item.to
        const isDisabled = disabled || isTransitioning || item.requiresApproval

        const button = (
          <Button
            key={item.to}
            variant={item.requiresApproval ? 'outline' : 'default'}
            onClick={() => handleTransition(item.to)}
            disabled={isDisabled}
          >
            {isTransitioning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('workflows.transitioning')}
              </>
            ) : (
              item.to
            )}
          </Button>
        )

        if (item.requiresApproval) {
          const hint = item.pendingApproval
            ? t('workflows.pendingApproval', { role: item.pendingApproval.role })
            : t('workflows.requiresApproval')
          return (
            <TooltipProvider key={item.to}>
              <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{hint}</span>
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
