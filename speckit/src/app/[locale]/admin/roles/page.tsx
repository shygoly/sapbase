/**
 * Roles Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { rolesApi } from '@/lib/api'
import { Role } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { RolesList } from './components/roles-list'
import { CreateRoleDialog } from './components/create-role-dialog'
import { EditRoleDialog } from './components/edit-role-dialog'
import { TableSkeleton } from '@/components/loading-skeleton'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// PageModel schema
const RolesPageModel: PageModel = {
  id: 'roles-page',
  title: 'Roles Management',
  description: 'Manage system roles and permissions',
  permissions: ['roles:read'],
}

// CollectionModel schema
const RolesCollectionModel: CollectionModel = {
  id: 'roles-collection',
  name: 'Roles',
  permissions: ['roles:read'],
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null)
  const notification = useNotification()

  // Fetch roles
  const fetchRoles = async () => {
    setIsLoading(true)
    try {
      const result = await rolesApi.findAll()
      setRoles(result)
    } catch (error) {
      notification.error('Failed to load roles')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, [])

  const handleCreateRole = async () => {
    setShowCreateDialog(false)
    await fetchRoles()
    notification.success('Role created successfully')
  }

  const handleDeleteRole = async (id: string) => {
    setRoleToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return

    try {
      await rolesApi.delete(roleToDelete)
      notification.success('Role deleted successfully')
      await fetchRoles()
    } catch (error) {
      notification.error('Failed to delete role')
    } finally {
      setRoleToDelete(null)
    }
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setShowEditDialog(true)
  }

  const handleUpdateRole = async () => {
    setShowEditDialog(false)
    setSelectedRole(null)
    await fetchRoles()
    notification.success('Role updated successfully')
  }

  const pageHeaderAction = (
    <PermissionGuard permission="roles:create">
      <Button onClick={() => setShowCreateDialog(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Role
      </Button>
    </PermissionGuard>
  )

  return (
    <PageRuntime model={RolesPageModel} isLoading={isLoading} pageHeaderAction={pageHeaderAction}>
      <div className="space-y-6">
        {/* Roles Table */}
        <CollectionRuntime model={RolesCollectionModel} isLoading={isLoading}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <RolesList roles={roles} onDelete={handleDeleteRole} onEdit={handleEditRole} />
          )}
        </CollectionRuntime>

        {/* Create Role Dialog */}
        <CreateRoleDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateRole}
        />

        {/* Edit Role Dialog */}
        <EditRoleDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={handleUpdateRole}
          role={selectedRole}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={confirmDeleteRole}
          title="Delete Role"
          description="Are you sure you want to delete this role? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </PageRuntime>
  )
}
