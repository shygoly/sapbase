'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, User, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { WorkflowHistory } from '@/lib/api/workflows.api'

interface WorkflowHistoryTimelineProps {
  history: WorkflowHistory[]
  compact?: boolean
  onEventClick?: (event: WorkflowHistory) => void
}

export function WorkflowHistoryTimeline({
  history,
}: WorkflowHistoryTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  if (history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No history available
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {history.map((event) => {
          const isExpanded = expandedEvents.has(event.id)

          return (
            <div key={event.id} className="relative flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-background border-2 border-primary">
                {event.guardResult?.passed !== undefined ? (
                  event.guardResult.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )
                ) : (
                  <div className="w-3 h-3 rounded-full bg-primary" />
                )}
              </div>

              {/* Event card */}
              <Card className="flex-1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {event.fromState ? (
                          <>
                            <Badge variant="outline">{event.fromState}</Badge>
                            <span>→</span>
                            <Badge>{event.toState}</Badge>
                          </>
                        ) : (
                          <Badge>Started: {event.toState}</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        {event.triggeredById && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {event.triggeredById}
                          </div>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 space-y-3 pt-4 border-t">
                          {event.guardResult && (
                            <div>
                              <div className="text-sm font-medium mb-1">Guard Condition</div>
                              {event.guardResult.expression && (
                                <div className="text-xs font-mono bg-muted p-2 rounded mb-1">
                                  {event.guardResult.expression}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {event.guardResult.passed ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span className="text-sm text-green-600 dark:text-green-400">
                                      Passed
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm text-red-600 dark:text-red-400">
                                      Failed
                                      {event.guardResult.error && `: ${event.guardResult.error}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {event.actionResult && (
                            <div>
                              <div className="text-sm font-medium mb-1">Action</div>
                              <div className="flex items-center gap-2">
                                {event.actionResult.executed ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span className="text-sm">
                                      Executed
                                      {event.actionResult.action && `: ${event.actionResult.action}`}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm text-red-600 dark:text-red-400">
                                      Failed
                                      {event.actionResult.error && `: ${event.actionResult.error}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div>
                              <div className="text-sm font-medium mb-1">Metadata</div>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand/collapse button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEvent(event.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
