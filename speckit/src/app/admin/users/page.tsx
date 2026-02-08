'use client'

import { useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
import { SchemaList } from '@/components/schema-list'
import { BatchOperations } from '@/components/batch-operations'
import { schemaResolver } from '@/core/schema/resolver'
import { schemaRegistry } from '@/core/schema/registry'
import { apiService } from '@/lib/api-service'
import { exportService } from '@/core/export/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { ObjectSchema, ResolvedPageSchema } from '@/core/schema/types'

export default function UsersPage() {
  const [pageSchema, setPageSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [users, setUsers] = useState<Record<string, any>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, any> | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Record<string, any>[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const resolved = await schemaResolver.resolvePage('users')
        setPageSchema(resolved)
        const objSchema = schemaRegistry.getObject('user')
        if (objSchema) setObjectSchema(objSchema)
        const data = await apiService.getUsers()
        setUsers(data)
      } catch (err) {
        console.error('Failed to load data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleCreateUser = () => {
    setEditingUser(null)
    setShowForm(true)
  }

  const handleEditUser = (user: Record<string, any>) => {
    setEditingUser(user)
    setShowForm(true)
  }

  const handleDeleteUser = (user: Record<string, any>) => {
    setDeleteConfirm(user)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await apiService.deleteUser(deleteConfirm.id)
      setUsers(users.filter(u => u.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete user:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleSubmitForm = async (data: Record<string, any>) => {
    try {
      let result: Record<string, any>
      if (editingUser) {
        result = await apiService.updateUser(editingUser.id, data)
        setUsers(users.map(u => (u.id === result.id ? result : u)))
      } else {
        result = await apiService.createUser(data)
        setUsers([...users, result])
      }
      setShowForm(false)
      setEditingUser(null)
    } catch (err) {
      console.error('Failed to save user:', err)
      setError(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedUsers.map(u => apiService.deleteUser(u.id)))
      setUsers(users.filter(u => !selectedUsers.find(su => su.id === u.id)))
      setSelectedUsers([])
    } catch (err) {
      console.error('Failed to delete users:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete users')
    }
  }

  const handleBatchExport = async () => {
    try {
      const dataToExport = selectedUsers.length > 0 ? selectedUsers : users
      exportService.exportToCSV(
        dataToExport,
        ['id', 'name', 'email', 'role', 'status'] as const,
        { filename: 'users' }
      )
    } catch (err) {
      console.error('Failed to export users:', err)
      setError(err instanceof Error ? err.message : 'Failed to export users')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin Center</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Users</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {pageSchema?.metadata?.title || 'Users'}
        </h1>
        <p className="text-muted-foreground">
          {pageSchema?.metadata?.description}
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!showForm ? (
        <div className="space-y-4">
          <Button onClick={handleCreateUser}>Create User</Button>

          <BatchOperations
            selectedCount={selectedUsers.length}
            onDelete={selectedUsers.length > 0 ? handleBatchDelete : undefined}
            onExport={handleBatchExport}
            onClearSelection={() => setSelectedUsers([])}
            isLoading={isLoading}
          />

          {objectSchema && (
            <SchemaList
              schema={objectSchema}
              data={users}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
              isLoading={isLoading}
            />
          )}
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{editingUser ? 'Edit User' : 'Create User'}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowForm(false)
                setEditingUser(null)
              }}
            >
              ✕
            </Button>
          </CardHeader>
          <CardContent>
            {objectSchema && (
              <SchemaForm
                schema={objectSchema}
                initialData={editingUser || {}}
                onSubmit={handleSubmitForm}
              />
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
