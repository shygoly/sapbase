'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User } from 'lucide-react'
import { TransitionHistoryEntry } from '@/lib/api/blueprints.api'
import { useTranslation } from '@/i18n'

interface WorkflowHistoryTimelineProps {
  history: TransitionHistoryEntry[]
}

export function WorkflowHistoryTimeline({ history }: WorkflowHistoryTimelineProps) {
  const t = useTranslation()

  if (history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {t('workflows.noHistory')}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {history.map((event, index) => (
          <div key={`${event.at}-${event.from}-${event.to}-${index}`} className="relative flex gap-4">
            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-background border-2 border-primary">
              <div className="w-3 h-3 rounded-full bg-primary" />
            </div>

            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{event.from}</Badge>
                  <span>→</span>
                  <Badge>{event.to}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(event.at).toLocaleString()}
                  </div>
                  {event.actor && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {event.actor}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
