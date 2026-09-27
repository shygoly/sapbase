/**
 * Users Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { usersApi, departmentsApi } from '@/lib/api'
import { User, Department } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { UsersList } from './components/users-list'
import { CreateUserDialog } from './components/create-user-dialog'
import { EditUserDialog } from './components/edit-user-dialog'
import { ChangePasswordDialog } from './components/change-password-dialog'
import { TableSkeleton } from '@/components/loading-skeleton'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// PageModel schema - defines page structure and permissions
const UsersPageModel: PageModel = {
  id: 'users-page',
  title: 'Users Management',
  description: 'Manage system users and their roles',
  permissions: ['users:read'],
}

// CollectionModel schema - defines collection structure and permissions
const UsersCollectionModel: CollectionModel = {
  id: 'users-collection',
  name: 'Users',
  permissions: ['users:read'],
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [departments, setDepartments] = useState<Department[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const notification = useNotification()

  // Fetch users
  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const result = await usersApi.findAll(page, pageSize, search)
      setUsers(result.data)
      setTotal(result.total)
    } catch (error) {
      notification.error('Failed to load users')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run on page, pageSize, search change
  }, [page, pageSize, search])

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const result = await departmentsApi.findAll(1, 1000)
        setDepartments(result.data)
      } catch (error) {
        notification.error('Failed to load departments')
      }
    }
    fetchDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateUser = async () => {
    setShowCreateDialog(false)
    await fetchUsers()
    notification.success('User created successfully')
  }

  const handleDeleteUser = async (id: string) => {
    setUserToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return

    try {
      await usersApi.delete(userToDelete)
      notification.success('User deleted successfully')
      await fetchUsers()
    } catch (error) {
      notification.error('Failed to delete user')
    } finally {
      setUserToDelete(null)
    }
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setShowEditDialog(true)
  }

  const handleUpdateUser = async () => {
    setShowEditDialog(false)
    setSelectedUser(null)
    await fetchUsers()
  }

  const handleChangePassword = (user: User) => {
    setSelectedUser(user)
    setShowChangePasswordDialog(true)
  }

  const handlePasswordChanged = async () => {
    setShowChangePasswordDialog(false)
    setSelectedUser(null)
  }

  // Page header action button
  const pageHeaderAction = (
    <PermissionGuard permission="users:create">
      <Button onClick={() => setShowCreateDialog(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create User
      </Button>
    </PermissionGuard>
  )

  return (
    <PageRuntime model={UsersPageModel} isLoading={isLoading} pageHeaderAction={pageHeaderAction}>
      <div className="space-y-6">
        {/* Search */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput)
                setPage(1)
              }
            }}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Users Table */}
        <CollectionRuntime model={UsersCollectionModel} isLoading={isLoading}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <UsersList
              users={users}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onDelete={handleDeleteUser}
              onEdit={handleEditUser}
              onChangePassword={handleChangePassword}
              departments={departments}
            />
          )}
        </CollectionRuntime>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateUser}
          departments={departments}
        />

        {/* Edit User Dialog */}
        <EditUserDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={handleUpdateUser}
          user={selectedUser}
          departments={departments}
        />

        {/* Change Password Dialog */}
        <ChangePasswordDialog
          open={showChangePasswordDialog}
          onOpenChange={setShowChangePasswordDialog}
          onSuccess={handlePasswordChanged}
          user={selectedUser}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={confirmDeleteUser}
          title="Delete User"
          description="Are you sure you want to delete this user? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </PageRuntime>
  )
}
