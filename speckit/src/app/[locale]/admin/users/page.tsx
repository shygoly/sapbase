/**
 * Users Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { usersApi } from '@/lib/api'
import { User } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { UsersList } from './components/users-list'
import { CreateUserDialog } from './components/create-user-dialog'
import { TableSkeleton } from '@/components/loading-skeleton'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'

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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
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

  const handleCreateUser = async () => {
    setShowCreateDialog(false)
    await fetchUsers()
    notification.success('User created successfully')
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      await usersApi.delete(id)
      notification.success('User deleted successfully')
      await fetchUsers()
    } catch (error) {
      notification.error('Failed to delete user')
    }
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
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
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
            />
          )}
        </CollectionRuntime>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateUser}
        />
      </div>
    </PageRuntime>
  )
}
