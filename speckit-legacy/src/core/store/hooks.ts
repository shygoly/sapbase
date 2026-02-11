'use client'

import { useWorkflowStore } from './workflow.store'
import { useFormStore } from './form.store'
import { useUIStore } from './ui.store'
import { usePermissionStore } from './permission.store'
import type { WorkflowInstance, ApprovalTask } from '@/core/state-machine/types'

/**
 * 集成 Hook：管理工作流状态
 * 结合 Zustand store 和现有的 WorkflowEngine
 */
export function useWorkflowState(workflowId?: string) {
  const {
    instances,
    approvalTasks,
    currentInstanceId,
    loading,
    error,
    setCurrentInstance,
    addInstance,
    updateInstance,
    addApprovalTask,
    updateApprovalTask,
    setLoading,
    setError,
  } = useWorkflowStore()

  const currentInstance = currentInstanceId ? instances.get(currentInstanceId) : undefined

  return {
    // State
    instances: Array.from(instances.values()),
    approvalTasks: Array.from(approvalTasks.values()),
    currentInstance,
    currentInstanceId,
    loading,
    error,

    // Actions
    setCurrentInstance,
    addInstance,
    updateInstance,
    addApprovalTask,
    updateApprovalTask,
    setLoading,
    setError,
  }
}

/**
 * 集成 Hook：管理表单状态
 * 结合 Zustand store 和现有的 useForm hook
 */
export function useFormState(formId: string, initialValues: Record<string, any>) {
  const {
    forms,
    initializeForm,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    setFormErrors,
    setFormValues,
    setSubmitting,
    incrementSubmitCount,
    resetForm,
    removeForm,
  } = useFormStore()

  const form = forms[formId]

  // Initialize form if not exists
  if (!form) {
    initializeForm(formId, initialValues)
  }

  return {
    // State
    values: form?.values || initialValues,
    errors: form?.errors || {},
    touched: form?.touched || {},
    isDirty: form?.isDirty || false,
    isSubmitting: form?.isSubmitting || false,
    submitCount: form?.submitCount || 0,

    // Actions
    setFieldValue: (fieldName: string, value: any) => setFieldValue(formId, fieldName, value),
    setFieldError: (fieldName: string, error: string) => setFieldError(formId, fieldName, error),
    setFieldTouched: (fieldName: string, touched: boolean) =>
      setFieldTouched(formId, fieldName, touched),
    setFormErrors: (errors: Record<string, string>) => setFormErrors(formId, errors),
    setFormValues: (values: Record<string, any>) => setFormValues(formId, values),
    setSubmitting: (isSubmitting: boolean) => setSubmitting(formId, isSubmitting),
    incrementSubmitCount: () => incrementSubmitCount(formId),
    resetForm: (newInitialValues?: Record<string, any>) =>
      resetForm(formId, newInitialValues || initialValues),
    removeForm: () => removeForm(formId),
  }
}

/**
 * 集成 Hook：管理 UI 状态
 */
export function useUIState() {
  const {
    ui,
    openModal,
    closeModal,
    toggleModal,
    isModalOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    toggleMainSidebar,
    setLoading,
    isLoading,
    setTheme,
    addNotification,
    removeNotification,
    clearNotifications,
    reset,
  } = useUIStore()

  return {
    // State
    ui,

    // Modal actions
    openModal,
    closeModal,
    toggleModal,
    isModalOpen,

    // Sidebar actions
    openSidebar,
    closeSidebar,
    toggleSidebar,
    toggleMainSidebar,
    isSidebarCollapsed: ui.sidebarCollapsed,

    // Loading actions
    setLoading,
    isLoading,

    // Theme actions
    setTheme,
    theme: ui.theme,

    // Notification actions
    addNotification,
    removeNotification,
    clearNotifications,
    notifications: ui.notifications,

    // Reset
    reset,
  }
}

/**
 * 集成 Hook：管理权限缓存
 */
export function usePermissionCache() {
  const {
    cache,
    checkPermission,
    setPermission,
    setPermissions,
    clearCache,
    clearExpiredCache,
  } = usePermissionStore()

  return {
    // State
    cache: Array.from(cache.entries()),

    // Actions
    checkPermission,
    setPermission,
    setPermissions,
    clearCache,
    clearExpiredCache,
  }
}
