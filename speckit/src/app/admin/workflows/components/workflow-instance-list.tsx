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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, Play, X } from 'lucide-react'
import { workflowsApi, WorkflowInstance } from '@/lib/api/workflows.api'
import { WorkflowInstanceViewer } from './workflow-instance-viewer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function WorkflowInstanceList() {
  const [instances, setInstances] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [filters, setFilters] = useState({
    workflowDefinitionId: '',
    entityType: '',
    entityId: '',
  })

  useEffect(() => {
    loadInstances()
  }, [filters])

  const loadInstances = async () => {
    try {
      setLoading(true)
      const data = await workflowsApi.getInstances(
        filters.workflowDefinitionId || undefined,
        filters.entityType || undefined,
        filters.entityId || undefined,
      )
      setInstances(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workflow instances')
    } finally {
      setLoading(false)
    }
  }

  const handleViewInstance = (instance: WorkflowInstance) => {
    setSelectedInstance(instance)
    setViewerOpen(true)
  }

  const handleCancelInstance = async (instanceId: string) => {
    if (!confirm('Cancel this workflow instance?')) return

    try {
      await workflowsApi.cancelInstance(instanceId)
      toast.success('Workflow instance cancelled')
      loadInstances()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel instance')
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
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading instances...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Workflow Instances</CardTitle>
          <CardDescription>View and manage active workflow instances</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Input
                placeholder="Entity Type"
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              />
            </div>
            <div>
              <Input
                placeholder="Entity ID"
                value={filters.entityId}
                onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
              />
            </div>
            <div>
              <Input
                placeholder="Workflow Definition ID"
                value={filters.workflowDefinitionId}
                onChange={(e) => setFilters({ ...filters, workflowDefinitionId: e.target.value })}
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Current State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Started By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No workflow instances found
                    </TableCell>
                  </TableRow>
                ) : (
                  instances.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{instance.entityType}</div>
                          <div className="text-sm text-muted-foreground">{instance.entityId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{instance.currentState}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(instance.status)}</TableCell>
                      <TableCell>
                        {new Date(instance.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{instance.startedById || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewInstance(instance)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {instance.status === 'running' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelInstance(instance.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Instance Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Instance Details</DialogTitle>
            <DialogDescription>View workflow instance status and history</DialogDescription>
          </DialogHeader>
          {selectedInstance && (
            <WorkflowInstanceViewer
              instance={selectedInstance}
              onClose={() => setViewerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
