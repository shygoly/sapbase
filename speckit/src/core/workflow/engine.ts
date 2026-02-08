import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowHistoryEntry,
  ApprovalTask,
} from '../state-machine/types'

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private instances: Map<string, WorkflowInstance> = new Map()
  private approvalTasks: Map<string, ApprovalTask> = new Map()

  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition)
  }

  createInstance(workflowId: string, context: Record<string, any> = {}): WorkflowInstance {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    const instance: WorkflowInstance = {
      id: `${workflowId}-${Date.now()}`,
      workflowId,
      currentState: workflow.states[Object.keys(workflow.states)[0]].name,
      context,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.instances.set(instance.id, instance)
    return instance
  }

  transitionState(
    instanceId: string,
    event: string,
    actor: string,
    comment?: string
  ): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) return false

    const workflow = this.workflows.get(instance.workflowId)
    if (!workflow) return false

    const transition = workflow.transitions.find(
      t => t.from === instance.currentState && t.event === event
    )
    if (!transition) return false

    const historyEntry: WorkflowHistoryEntry = {
      from: instance.currentState,
      to: transition.to,
      event,
      actor,
      timestamp: new Date(),
      comment,
    }

    instance.history.push(historyEntry)
    instance.currentState = transition.to
    instance.updatedAt = new Date()

    return true
  }

  getAvailableTransitions(instanceId: string): string[] {
    const instance = this.instances.get(instanceId)
    if (!instance) return []

    const workflow = this.workflows.get(instance.workflowId)
    if (!workflow) return []

    return workflow.transitions
      .filter(t => t.from === instance.currentState)
      .map(t => t.event)
  }

  createApprovalTask(
    instanceId: string,
    state: string,
    assignee: string,
    dueDate?: Date
  ): ApprovalTask {
    const task: ApprovalTask = {
      id: `task-${Date.now()}`,
      workflowId: instanceId,
      state,
      assignee,
      status: 'pending',
      createdAt: new Date(),
      dueDate,
    }

    this.approvalTasks.set(task.id, task)
    return task
  }

  approveTask(taskId: string, comment?: string): boolean {
    const task = this.approvalTasks.get(taskId)
    if (!task) return false

    task.status = 'approved'
    task.comment = comment
    return true
  }

  rejectTask(taskId: string, comment?: string): boolean {
    const task = this.approvalTasks.get(taskId)
    if (!task) return false

    task.status = 'rejected'
    task.comment = comment
    return true
  }

  getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId)
  }

  getHistory(instanceId: string): WorkflowHistoryEntry[] {
    const instance = this.instances.get(instanceId)
    return instance?.history || []
  }
}
