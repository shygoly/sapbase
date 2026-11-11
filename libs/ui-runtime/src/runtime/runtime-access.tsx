'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { usePermissionStore } from '@sap/shared-state/core/store'

export interface AccessRule {
  /** 任一权限满足即可（空/缺省表示不限制）。 */
  permissions?: string[]
  requireAll?: boolean
}

export interface FieldAccessRule {
  view?: string[]
  edit?: string[]
}

export interface RuntimeAction {
  id: string
  label: string
  permissions?: string[]
  destructive?: boolean
}

export interface RuntimeAccessModel {
  permissions?: string[]
  requireAll?: boolean
  fieldAccess?: Record<string, FieldAccessRule>
  /** 行级可见性；不满足时列表隐藏该行。 */
  rowAccess?: AccessRule
  actions?: RuntimeAction[]
}

interface RuntimeAccessValue {
  can: (permissions?: string[], requireAll?: boolean) => boolean
  canViewField: (field: string) => boolean
  canEditField: (field: string) => boolean
  canRunAction: (actionId: string) => boolean
  canAccessRow: (row: unknown) => boolean
  visibleActions: RuntimeAction[]
}

const RuntimeAccessContext = createContext<RuntimeAccessValue | null>(null)

/**
 * Runtime 级权限拦截：按钮/字段/行级规则统一从这里判定。
 * 这里只做 UI 可见性，写操作仍必须由后端鉴权。
 */
export function RuntimeAccessProvider({
  model,
  children,
}: {
  model: RuntimeAccessModel
  children: React.ReactNode
}) {
  const { hasAnyPermission, hasAllPermissions } = usePermissionStore()
  const value = useMemo<RuntimeAccessValue>(() => {
    const can = (permissions?: string[], requireAll = false) => {
      if (!permissions || permissions.length === 0) return true
      return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
    }
    const canViewField = (field: string) =>
      can(model.fieldAccess?.[field]?.view)
    const canEditField = (field: string) =>
      can(model.fieldAccess?.[field]?.edit)
    const canRunAction = (actionId: string) => {
      const action = model.actions?.find((item) => item.id === actionId)
      if (!action) return false
      return can(action.permissions)
    }
    const canAccessRow = (_row: unknown) => can(model.rowAccess?.permissions, model.rowAccess?.requireAll)
    return {
      can,
      canViewField,
      canEditField,
      canRunAction,
      canAccessRow,
      visibleActions: (model.actions ?? []).filter((action) => can(action.permissions)),
    }
  }, [model, hasAnyPermission, hasAllPermissions])

  return (
    <RuntimeAccessContext.Provider value={value}>
      {children}
    </RuntimeAccessContext.Provider>
  )
}

export function useRuntimeAccess(): RuntimeAccessValue {
  const value = useContext(RuntimeAccessContext)
  if (!value) {
    return {
      can: () => true,
      canViewField: () => true,
      canEditField: () => true,
      canRunAction: () => false,
      canAccessRow: () => true,
      visibleActions: [],
    }
  }
  return value
}

/** 字段级包装：无 view 权限时不渲染；edit 权限通过 render prop 暴露。 */
export function FieldGuard({
  field,
  children,
}: {
  field: string
  children: (state: { editable: boolean }) => React.ReactNode
}) {
  const access = useRuntimeAccess()
  if (!access.canViewField(field)) return null
  return <>{children({ editable: access.canEditField(field) })}</>
}

/** 动作按钮包装：无权限时不渲染。 */
export function ActionGuard({
  action,
  children,
}: {
  action: string
  children: React.ReactNode
}) {
  const access = useRuntimeAccess()
  if (!access.canRunAction(action)) return null
  return <>{children}</>
}
