'use client'

import { useState, useCallback } from 'react'
import { WorkflowEngine } from './engine'
import type { WorkflowDefinition, WorkflowInstance, ApprovalTask } from '../state-machine/types'

const workflowEngine = new WorkflowEngine()

export function useWorkflow(workflowId: string, initialContext?: Record<string, any>) {
  const [instance, setInstance] = useState<WorkflowInstance | null>(null)
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([])

  const createWorkflow = useCallback(() => {
    const newInstance = workflowEngine.createInstance(workflowId, initialContext)
    setInstance(newInstance)
    return newInstance
  }, [workflowId, initialContext])

  const transitionState = useCallback(
    (event: string, actor: string, comment?: string) => {
      if (!instance) return false
      const success = workflowEngine.transitionState(instance.id, event, actor, comment)
      if (success) {
        const updated = workflowEngine.getInstance(instance.id)
        if (updated) setInstance(updated)
      }
      return success
    },
    [instance]
  )

  const getAvailableTransitions = useCallback(() => {
    if (!instance) return []
    return workflowEngine.getAvailableTransitions(instance.id)
  }, [instance])

  const getHistory = useCallback(() => {
    if (!instance) return []
    return workflowEngine.getHistory(instance.id)
  }, [instance])

  const createApprovalTask = useCallback(
    (state: string, assignee: string, dueDate?: Date) => {
      if (!instance) return null
      const task = workflowEngine.createApprovalTask(instance.id, state, assignee, dueDate)
      setApprovalTasks(prev => [...prev, task])
      return task
    },
    [instance]
  )

  return {
    instance,
    approvalTasks,
    createWorkflow,
    transitionState,
    getAvailableTransitions,
    getHistory,
    createApprovalTask,
  }
}
