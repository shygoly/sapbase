'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Save } from 'lucide-react'
import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
} from '@/lib/api/workflows.api'
import { workflowsApi } from '@/lib/api/workflows.api'
import { toast } from 'sonner'

interface WorkflowDefinitionEditorProps {
  workflow?: WorkflowDefinition
  onSave?: (workflow: WorkflowDefinition) => void
  onDelete?: () => void
  onCancel?: () => void
}

export function WorkflowDefinitionEditor({
  workflow,
  onSave,
  onDelete,
  onCancel,
}: WorkflowDefinitionEditorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entityType, setEntityType] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'draft'>('draft')
  const [states, setStates] = useState<WorkflowState[]>([])
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (workflow) {
      setName(workflow.name)
      setDescription(workflow.description || '')
      setEntityType(workflow.entityType)
      setStatus(workflow.status)
      setStates(workflow.states || [])
      setTransitions(workflow.transitions || [])
    }
  }, [workflow])

  const handleAddState = () => {
    const stateName = prompt('Enter state name:')
    if (stateName && !states.find((s) => s.name === stateName)) {
      setStates([
        ...states,
        {
          name: stateName,
          initial: states.length === 0, // First state is initial
          final: false,
          metadata: {},
        },
      ])
    }
  }

  const handleDeleteState = (stateName: string) => {
    if (confirm(`Delete state "${stateName}"? This will also delete related transitions.`)) {
      setStates(states.filter((s) => s.name !== stateName))
      setTransitions(transitions.filter((t) => t.from !== stateName && t.to !== stateName))
    }
  }

  const handleToggleStateProperty = (stateName: string, property: 'initial' | 'final') => {
    setStates(
      states.map((s) => {
        if (s.name === stateName) {
          if (property === 'initial') {
            // Only one initial state allowed
            return { ...s, initial: !s.initial, final: false }
          } else {
            return { ...s, final: !s.final, initial: false }
          }
        } else if (property === 'initial') {
          // Unset other initial states
          return { ...s, initial: false }
        }
        return s
      }),
    )
  }

  const handleAddTransition = () => {
    if (states.length < 2) {
      toast.error('Need at least 2 states to create a transition')
      return
    }

    const fromState = prompt('From state:')
    const toState = prompt('To state:')
    if (fromState && toState && states.find((s) => s.name === fromState) && states.find((s) => s.name === toState)) {
      if (!transitions.find((t) => t.from === fromState && t.to === toState)) {
        setTransitions([
          ...transitions,
          {
            from: fromState,
            to: toState,
            guard: '',
            action: '',
            metadata: {},
          },
        ])
      }
    }
  }

  const handleDeleteTransition = (index: number) => {
    setTransitions(transitions.filter((_, i) => i !== index))
  }

  const handleUpdateTransition = (index: number, updates: Partial<WorkflowTransition>) => {
    setTransitions(transitions.map((t, i) => (i === index ? { ...t, ...updates } : t)))
  }

  const handleSave = async () => {
    if (!name || !entityType || states.length === 0) {
      toast.error('Please fill in all required fields and add at least one state')
      return
    }

    // Validate: exactly one initial state
    const initialStates = states.filter((s) => s.initial)
    if (initialStates.length !== 1) {
      toast.error('Workflow must have exactly one initial state')
      return
    }

    try {
      setLoading(true)
      let saved: WorkflowDefinition

      if (workflow) {
        // Update existing
        const updateDto: UpdateWorkflowDefinitionDto = {
          name,
          description,
          states,
          transitions,
          status,
        }
        saved = await workflowsApi.updateWorkflow(workflow.id, updateDto)
      } else {
        // Create new
        const createDto: CreateWorkflowDefinitionDto = {
          name,
          description,
          entityType,
          states,
          transitions,
        }
        saved = await workflowsApi.createWorkflow(createDto)
      }

      toast.success(`Workflow ${workflow ? 'updated' : 'created'} successfully`)

      if (onSave) {
        onSave(saved)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!workflow || !confirm(`Delete workflow "${workflow.name}"?`)) {
      return
    }

    try {
      setLoading(true)
      await workflowsApi.deleteWorkflow(workflow.id)
      toast.success('Workflow deleted successfully')
      if (onDelete) {
        onDelete()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workflow')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Opportunity Workflow"
            disabled={!!workflow}
          />
        </div>
        <div>
          <Label htmlFor="entityType">Entity Type *</Label>
          <Input
            id="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="e.g., Opportunity"
            disabled={!!workflow}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Workflow description"
        />
      </div>

      {workflow && (
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* States */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>States</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddState}>
              <Plus className="h-4 w-4 mr-2" />
              Add State
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {states.map((state) => (
              <div key={state.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{state.name}</span>
                  {state.initial && <Badge variant="default">Initial</Badge>}
                  {state.final && <Badge variant="secondary">Final</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStateProperty(state.name, 'initial')}
                  >
                    {state.initial ? '✓' : 'Set Initial'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStateProperty(state.name, 'final')}
                  >
                    {state.final ? '✓' : 'Set Final'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteState(state.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {states.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No states defined. Add your first state to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transitions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transitions</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddTransition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transitions.map((transition, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>{transition.from}</Badge>
                    <span>→</span>
                    <Badge>{transition.to}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTransition(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Guard Condition (optional)</Label>
                    <Input
                      value={transition.guard || ''}
                      onChange={(e) =>
                        handleUpdateTransition(index, { guard: e.target.value })
                      }
                      placeholder="e.g., entity.amount > 1000"
                    />
                  </div>
                  <div>
                    <Label>Action (optional)</Label>
                    <Input
                      value={transition.action || ''}
                      onChange={(e) =>
                        handleUpdateTransition(index, { action: e.target.value })
                      }
                      placeholder="e.g., notify:message"
                    />
                  </div>
                </div>
              </div>
            ))}
            {transitions.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No transitions defined. Add transitions to connect states.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            Delete
          </Button>
        )}
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {workflow ? 'Update' : 'Create'} Workflow
        </Button>
      </div>
    </div>
  )
}
