'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  RecordEnvelope,
  TransitionHistoryEntry,
  SuggestedTransition,
  blueprintsApi,
} from '@/lib/api/blueprints.api'
import { WorkflowTransitionButtons } from './workflow-transition-buttons'
import { WorkflowHistoryTimeline } from './workflow-history-timeline'
import { Button } from '@/components/ui/button'
import { Clock, Package, Sparkles } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface WorkflowInstanceViewerProps {
  packageId: string
  entity: string
  record: RecordEnvelope
  onClose?: () => void
}

export function WorkflowInstanceViewer({
  packageId,
  entity,
  record,
  onClose: _onClose,
}: WorkflowInstanceViewerProps) {
  void _onClose
  const t = useTranslation()
  const [history, setHistory] = useState<TransitionHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<RecordEnvelope>(record)
  const [suggestions, setSuggestions] = useState<SuggestedTransition[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  useEffect(() => {
    loadHistory()
    loadRecord()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 按记录 id 重载
  }, [packageId, entity, record.id])

  const loadHistory = async () => {
    try {
      const data = await blueprintsApi.getHistory(packageId, entity, record.id)
      setHistory(data)
    } catch {
      // 错误已由 toast / 空态呈现
    }
  }

  const loadRecord = async () => {
    try {
      const data = await blueprintsApi.getRecord(packageId, entity, record.id)
      setCurrent(data)
    } catch {
      // 错误已由 toast / 空态呈现
    } finally {
      setLoading(false)
    }
  }

  const handleTransitionSuccess = () => {
    loadRecord()
    loadHistory()
    setSuggestions([])
  }

  const loadSuggestions = async () => {
    setSuggestionsLoading(true)
    setSuggestions([])
    try {
      const data = await blueprintsApi.getSuggestedTransitions(packageId, entity, record.id)
      setSuggestions(data)
    } catch {
      // 错误已由 toast / 空态呈现
    } finally {
      setSuggestionsLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('workflows.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('workflows.recordDetails')}</CardTitle>
              <CardDescription>{t('workflows.recordDetailsHint')}</CardDescription>
            </div>
            {current.state && <Badge variant="outline">{current.state}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('workflows.entity')}</div>
              <div className="flex items-center gap-2 mt-1">
                <Package className="h-4 w-4" />
                <span className="font-medium">{current.entity}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('workflows.recordId')}</div>
              <div className="font-mono text-sm mt-1">{current.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('workflows.currentState')}</div>
              <Badge variant="outline" className="mt-1">
                {current.state ?? '-'}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('workflows.version')}</div>
              <div className="mt-1">{current.version}</div>
            </div>
            {current.createdAt && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('workflows.startedAt')}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(current.createdAt).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {current.data && Object.keys(current.data).length > 0 && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">{t('workflows.recordData')}</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                  {JSON.stringify(current.data, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t('workflows.suggested')}
          </CardTitle>
          <CardDescription>{t('workflows.suggestedHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSuggestions}
            disabled={suggestionsLoading}
          >
            {suggestionsLoading ? t('workflows.loading') : t('workflows.getSuggestions')}
          </Button>
          {suggestions.length > 0 && (
            <WorkflowTransitionButtons
              packageId={packageId}
              entity={entity}
              recordId={current.id}
              version={current.version}
              suggestions={suggestions}
              onTransition={handleTransitionSuccess}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.history')}</CardTitle>
          <CardDescription>{t('workflows.historyHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowHistoryTimeline history={history} />
        </CardContent>
      </Card>
    </div>
  )
}
