'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  WorkflowInstance,
  WorkflowHistory,
  SuggestedTransition,
} from '@/lib/api/workflows.api'
import { workflowsApi } from '@/lib/api/workflows.api'
import { WorkflowTransitionButtons } from './workflow-transition-buttons'
import { WorkflowHistoryTimeline } from './workflow-history-timeline'
import { Button } from '@/components/ui/button'
import { Clock, User, Package, Sparkles } from 'lucide-react'

interface WorkflowInstanceViewerProps {
  instance: WorkflowInstance
  onClose?: () => void
}

export function WorkflowInstanceViewer({ instance, onClose: _onClose }: WorkflowInstanceViewerProps) {
  void _onClose
  const [history, setHistory] = useState<WorkflowHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [currentInstance, setCurrentInstance] = useState<WorkflowInstance>(instance)
  const [suggestions, setSuggestions] = useState<SuggestedTransition[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  useEffect(() => {
    loadHistory()
    loadInstanceDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when instance.id changes
  }, [instance.id])

  const loadHistory = async () => {
    try {
      const data = await workflowsApi.getHistory(instance.id)
      setHistory(data)
    } catch (error) {
      // error already surfaced via UI
    }
  }

  const loadInstanceDetails = async () => {
    try {
      const data = await workflowsApi.getInstance(instance.id)
      setCurrentInstance(data)
    } catch (error) {
      // error already surfaced via UI
    } finally {
      setLoading(false)
    }
  }

  const handleTransitionSuccess = () => {
    loadInstanceDetails()
    loadHistory()
    setSuggestions([])
  }

  const loadSuggestions = async () => {
    setSuggestionsLoading(true)
    setSuggestions([])
    try {
      const data = await workflowsApi.getSuggestedTransitions(
        instance.id,
        currentInstance.context,
      )
      setSuggestions(data)
    } catch (error) {
      // error already surfaced via UI
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const handleSuggestedTransition = async (toState: string) => {
    try {
      await workflowsApi.executeTransition(instance.id, { toState })
      handleTransitionSuccess()
    } catch (error) {
      // error already surfaced via UI
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      running: 'default',
      completed: 'secondary',
      failed: 'destructive',
      cancelled: 'outline',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Instance Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Instance Information</CardTitle>
              <CardDescription>Workflow instance details and current status</CardDescription>
            </div>
            {getStatusBadge(currentInstance.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Entity Type</div>
              <div className="flex items-center gap-2 mt-1">
                <Package className="h-4 w-4" />
                <span className="font-medium">{currentInstance.entityType}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Entity ID</div>
              <div className="font-mono text-sm mt-1">{currentInstance.entityId}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Current State</div>
              <Badge variant="outline" className="mt-1">
                {currentInstance.currentState}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Started At</div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4" />
                <span>{new Date(currentInstance.startedAt).toLocaleString()}</span>
              </div>
            </div>
            {currentInstance.completedAt && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Completed At</div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(currentInstance.completedAt).toLocaleString()}</span>
                </div>
              </div>
            )}
            {currentInstance.startedById && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Started By</div>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  <span>{currentInstance.startedById}</span>
                </div>
              </div>
            )}
          </div>

          {currentInstance.context && Object.keys(currentInstance.context).length > 0 && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Context</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                  {JSON.stringify(currentInstance.context, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI suggested next steps */}
      {currentInstance.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI 推荐
            </CardTitle>
            <CardDescription>
              Get AI-recommended next transitions for this instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSuggestions}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? 'Loading…' : 'Get AI suggestions'}
            </Button>
            {suggestions.length > 0 && (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.toState}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <span className="font-medium">{s.toState}</span>
                      {s.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{s.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSuggestedTransition(s.toState)}
                    >
                      Go
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Transitions */}
      {currentInstance.status === 'running' && currentInstance.availableTransitions && (
        <Card>
          <CardHeader>
            <CardTitle>Available Transitions</CardTitle>
            <CardDescription>Execute state transitions for this workflow instance</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowTransitionButtons
              instance={currentInstance}
              availableTransitions={currentInstance.availableTransitions}
              onTransition={handleTransitionSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Chronological record of all workflow transitions</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowHistoryTimeline history={history} />
        </CardContent>
      </Card>
    </div>
  )
}
