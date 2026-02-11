'use client'

import { useMemo, useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { CollectionRuntime } from '@/components/runtime/collection-runtime'
import { FormRuntime } from '@/components/runtime/form-runtime'
import { buildPageModel, toCollectionSchema, toFormSchema } from '@/components/runtime/schema-adapters'
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
import { EnhancedBatchOperations, type BatchAction } from '@/components/ui/table/enhanced-batch-operations'
import { UsersTable } from './users-table'
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

  const pageModel = useMemo(() => {
    return buildPageModel({
      id: 'admin-users',
      path: '/admin/users',
      fallbackTitle: 'Users',
      fallbackDescription: 'User management',
      pageSchema,
    })
  }, [pageSchema])

  const collectionSchema = useMemo(() => {
    return objectSchema
      ? toCollectionSchema(objectSchema, pageSchema)
      : { id: 'users-collection', title: 'Users', columns: [] }
  }, [objectSchema, pageSchema])

  const formSchema = useMemo(() => {
    return objectSchema
      ? toFormSchema(objectSchema)
      : { id: 'user-form', title: 'User', fields: [] }
  }, [objectSchema])

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
      setError(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedUsers.map(u => apiService.deleteUser(u.id)))
      setUsers(users.filter(u => !selectedUsers.find(su => su.id === u.id)))
      setSelectedUsers([])
    } catch (err) {
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
      setError(err instanceof Error ? err.message : 'Failed to export users')
    }
  }

  if (isLoading) {
    return (
      <PageRuntime model={pageModel} className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </PageRuntime>
    )
  }

  return (
    <PageRuntime model={pageModel} className="p-6 space-y-6">
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
        <CollectionRuntime schema={collectionSchema} data={users} isLoading={isLoading}>
          <div className="space-y-4">
            <Button onClick={handleCreateUser}>Create User</Button>

            <EnhancedBatchOperations
              selectedCount={selectedUsers.length}
              totalCount={users.length}
              actions={[
                {
                  id: 'export',
                  label: 'Export',
                  onClick: handleBatchExport,
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  variant: 'destructive',
                  onClick: handleBatchDelete,
                  disabled: selectedUsers.length === 0,
                },
              ]}
              onClearSelection={() => setSelectedUsers([])}
              isLoading={isLoading}
            />

            <UsersTable
              data={users}
              selectedUsers={selectedUsers}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
              onSelectionChange={setSelectedUsers}
              isLoading={isLoading}
            />
          </div>
        </CollectionRuntime>
      ) : (
        <FormRuntime schema={formSchema}>
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
        </FormRuntime>
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
    </PageRuntime>
  )
}
