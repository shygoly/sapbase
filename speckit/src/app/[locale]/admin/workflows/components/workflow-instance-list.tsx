'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, X } from 'lucide-react'
import {
  blueprintsApi,
  RecordEnvelope,
  SemanticEntity,
} from '@/lib/api/blueprints.api'
import { WorkflowInstanceViewer } from './workflow-instance-viewer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTranslation } from '@/i18n'

interface WorkflowInstanceListProps {
  packageId: string
  entity: string
  semantic: SemanticEntity
}

function finalTargetsFrom(semantic: SemanticEntity, from?: string): string[] {
  const finals = new Set(semantic.states.filter((state) => state.final).map((state) => state.name))
  return semantic.transitions
    .filter((item) => (!from || item.from === from) && finals.has(item.to))
    .map((item) => item.to)
}

export function WorkflowInstanceList({ packageId, entity, semantic }: WorkflowInstanceListProps) {
  const t = useTranslation()
  const [records, setRecords] = useState<RecordEnvelope[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RecordEnvelope | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [recordIdFilter, setRecordIdFilter] = useState('')

  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 筛选变化时重载
  }, [packageId, entity, stateFilter])

  const loadRecords = async () => {
    try {
      setLoading(true)
      const page = await blueprintsApi.listRecords(packageId, entity, {
        state: stateFilter || undefined,
        page: 1,
        pageSize: 50,
      })
      setRecords(page.items ?? [])
      setTotal(page.total ?? 0)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('workflows.loadFailed')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const visible = recordIdFilter
    ? records.filter((row) => row.id.includes(recordIdFilter))
    : records

  const handleView = (row: RecordEnvelope) => {
    setSelected(row)
    setViewerOpen(true)
  }

  const handleCancel = async (row: RecordEnvelope) => {
    if (!confirm(t('workflows.cancelConfirm'))) return

    try {
      const suggestions = await blueprintsApi.getSuggestedTransitions(packageId, entity, row.id)
      const finals = new Set(semantic.states.filter((state) => state.final).map((state) => state.name))
      const target = suggestions.find((item) => finals.has(item.to))
      if (!target) {
        toast.error(t('workflows.cancelFailed'))
        return
      }
      await blueprintsApi.executeTransition(packageId, entity, row.id, {
        to: target.to,
        expectedVersion: row.version,
      })
      toast.success(t('workflows.cancelSuccess'))
      loadRecords()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('workflows.cancelFailed')
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('workflows.loading')}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.instances')}</CardTitle>
          <CardDescription>
            {entity} · {total}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              placeholder={t('workflows.state')}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            />
            <Input
              placeholder={t('workflows.recordId')}
              value={recordIdFilter}
              onChange={(e) => setRecordIdFilter(e.target.value)}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workflows.entity')}</TableHead>
                  <TableHead>{t('workflows.currentState')}</TableHead>
                  <TableHead>{t('workflows.version')}</TableHead>
                  <TableHead>{t('workflows.startedAt')}</TableHead>
                  <TableHead className="text-right">{t('workflows.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t('workflows.noRecords')}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => {
                    const canCancel = finalTargetsFrom(semantic, row.state).length > 0
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{row.entity}</div>
                            <div className="text-sm text-muted-foreground">{row.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.state ?? '-'}</Badge>
                        </TableCell>
                        <TableCell>{row.version}</TableCell>
                        <TableCell>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleView(row)}>
                              <Eye className="h-4 w-4 mr-1" />
                              {t('workflows.view')}
                            </Button>
                            {canCancel ? (
                              <Button variant="destructive" size="sm" onClick={() => handleCancel(row)}>
                                <X className="h-4 w-4 mr-1" />
                                {t('workflows.cancel')}
                              </Button>
                            ) : (
                              <span className="sr-only">{t('workflows.cancelHidden')}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {!visible.some((row) => finalTargetsFrom(semantic, row.state).length > 0) && visible.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">{t('workflows.cancelHidden')}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('workflows.recordDetails')}</DialogTitle>
            <DialogDescription>{t('workflows.recordDetailsHint')}</DialogDescription>
          </DialogHeader>
          {selected && (
            <WorkflowInstanceViewer
              packageId={packageId}
              entity={entity}
              record={selected}
              onClose={() => setViewerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
