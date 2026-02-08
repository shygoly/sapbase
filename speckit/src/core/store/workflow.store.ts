import { create } from 'zustand'
import type { WorkflowInstance, ApprovalTask } from '@/core/state-machine/types'

export interface WorkflowState {
  instances: Map<string, WorkflowInstance>
  approvalTasks: Map<string, ApprovalTask>
  currentInstanceId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentInstance: (instanceId: string | null) => void
  addInstance: (instance: WorkflowInstance) => void
  updateInstance: (instanceId: string, updates: Partial<WorkflowInstance>) => void
  removeInstance: (instanceId: string) => void
  addApprovalTask: (task: ApprovalTask) => void
  updateApprovalTask: (taskId: string, updates: Partial<ApprovalTask>) => void
  removeApprovalTask: (taskId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  instances: new Map(),
  approvalTasks: new Map(),
  currentInstanceId: null,
  loading: false,
  error: null,

  setCurrentInstance: (instanceId) =>
    set({ currentInstanceId: instanceId }),

  addInstance: (instance) =>
    set((state) => {
      const newInstances = new Map(state.instances)
      newInstances.set(instance.id, instance)
      return { instances: newInstances }
    }),

  updateInstance: (instanceId, updates) =>
    set((state) => {
      const newInstances = new Map(state.instances)
      const instance = newInstances.get(instanceId)
      if (instance) {
        newInstances.set(instanceId, { ...instance, ...updates })
      }
      return { instances: newInstances }
    }),

  removeInstance: (instanceId) =>
    set((state) => {
      const newInstances = new Map(state.instances)
      newInstances.delete(instanceId)
      return {
        instances: newInstances,
        currentInstanceId: state.currentInstanceId === instanceId ? null : state.currentInstanceId,
      }
    }),

  addApprovalTask: (task) =>
    set((state) => {
      const newTasks = new Map(state.approvalTasks)
      newTasks.set(task.id, task)
      return { approvalTasks: newTasks }
    }),

  updateApprovalTask: (taskId, updates) =>
    set((state) => {
      const newTasks = new Map(state.approvalTasks)
      const task = newTasks.get(taskId)
      if (task) {
        newTasks.set(taskId, { ...task, ...updates })
      }
      return { approvalTasks: newTasks }
    }),

  removeApprovalTask: (taskId) =>
    set((state) => {
      const newTasks = new Map(state.approvalTasks)
      newTasks.delete(taskId)
      return { approvalTasks: newTasks }
    }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      instances: new Map(),
      approvalTasks: new Map(),
      currentInstanceId: null,
      loading: false,
      error: null,
    }),
}))
