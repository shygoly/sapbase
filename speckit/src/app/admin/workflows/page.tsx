'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Workflow } from 'lucide-react'
import { workflowsApi, WorkflowDefinition } from '@/lib/api/workflows.api'
import { WorkflowDefinitionEditor } from './components/workflow-definition-editor'
import { WorkflowStateDiagram } from './components/workflow-state-diagram'
import { WorkflowInstanceList } from './components/workflow-instance-list'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      setLoading(true)
      const data = await workflowsApi.getWorkflows()
      setWorkflows(data)
      if (data.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(data[0])
      }
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowCreated = (workflow: WorkflowDefinition) => {
    setWorkflows([...workflows, workflow])
    setSelectedWorkflow(workflow)
    setIsCreateDialogOpen(false)
  }

  const handleWorkflowUpdated = (workflow: WorkflowDefinition) => {
    setWorkflows(workflows.map((w) => (w.id === workflow.id ? workflow : w)))
    setSelectedWorkflow(workflow)
  }

  const handleWorkflowDeleted = (workflowId: string) => {
    setWorkflows(workflows.filter((w) => w.id !== workflowId))
    if (selectedWorkflow?.id === workflowId) {
      setSelectedWorkflow(workflows.length > 1 ? workflows.find((w) => w.id !== workflowId) || null : null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading workflows...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Manage workflow definitions and instances</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>Define a new workflow with states and transitions</DialogDescription>
            </DialogHeader>
            <WorkflowDefinitionEditor
              onSave={handleWorkflowCreated}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="definitions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="definitions">Workflow Definitions</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workflow List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    Workflows
                  </CardTitle>
                  <CardDescription>{workflows.length} workflow(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        onClick={() => setSelectedWorkflow(workflow)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedWorkflow?.id === workflow.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">{workflow.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {workflow.entityType} • {workflow.status}
                        </div>
                      </div>
                    ))}
                    {workflows.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No workflows found. Create your first workflow to get started.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workflow Details */}
            <div className="lg:col-span-2 space-y-4">
              {selectedWorkflow ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedWorkflow.name}</CardTitle>
                      <CardDescription>{selectedWorkflow.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <WorkflowDefinitionEditor
                        workflow={selectedWorkflow}
                        onSave={handleWorkflowUpdated}
                        onDelete={() => handleWorkflowDeleted(selectedWorkflow.id)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>State Diagram</CardTitle>
                      <CardDescription>Visual representation of workflow states and transitions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <WorkflowStateDiagram workflow={selectedWorkflow} />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center text-muted-foreground">
                      <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a workflow to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="instances">
          <WorkflowInstanceList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
