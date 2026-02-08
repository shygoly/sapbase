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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export default function RolesPage() {
  const [pageSchema, setPageSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [roles, setRoles] = useState<Record<string, any>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, any> | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Record<string, any>[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const resolved = await schemaResolver.resolvePage('roles')
        setPageSchema(resolved)
        const objSchema = schemaRegistry.getObject('role')
        if (objSchema) setObjectSchema(objSchema)
        const data = await apiService.getRoles()
        setRoles(data)
      } catch (err) {
        console.error('Failed to load data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleCreateRole = () => {
    setEditingRole(null)
    setShowForm(true)
  }

  const handleEditRole = (role: Record<string, any>) => {
    setEditingRole(role)
    setShowForm(true)
  }

  const handleDeleteRole = (role: Record<string, any>) => {
    setDeleteConfirm(role)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await apiService.deleteRole(deleteConfirm.id)
      setRoles(roles.filter(r => r.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete role:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete role')
    }
  }

  const handleSubmitForm = async (data: Record<string, any>) => {
    try {
      let result: Record<string, any>
      if (editingRole) {
        result = await apiService.updateRole(editingRole.id, data)
        setRoles(roles.map(r => (r.id === result.id ? result : r)))
      } else {
        result = await apiService.createRole(data)
        setRoles([...roles, result])
      }
      setShowForm(false)
      setEditingRole(null)
    } catch (err) {
      console.error('Failed to save role:', err)
      setError(err instanceof Error ? err.message : 'Failed to save role')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedRoles.map(r => apiService.deleteRole(r.id)))
      setRoles(roles.filter(r => !selectedRoles.find(sr => sr.id === r.id)))
      setSelectedRoles([])
    } catch (err) {
      console.error('Failed to delete roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete roles')
    }
  }

  const handleBatchExport = async () => {
    try {
      const dataToExport = selectedRoles.length > 0 ? selectedRoles : roles
      exportService.exportToCSV(
        dataToExport,
        ['id', 'name', 'description'] as const,
        { filename: 'roles' }
      )
    } catch (err) {
      console.error('Failed to export roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to export roles')
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
            <BreadcrumbPage>Roles</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {pageSchema?.metadata?.title || 'Roles'}
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
          <Button onClick={handleCreateRole}>Create Role</Button>

          <BatchOperations
            selectedCount={selectedRoles.length}
            onDelete={selectedRoles.length > 0 ? handleBatchDelete : undefined}
            onExport={handleBatchExport}
            onClearSelection={() => setSelectedRoles([])}
            isLoading={isLoading}
          />

          {objectSchema && (
            <SchemaList
              schema={objectSchema}
              data={roles}
              onEdit={handleEditRole}
              onDelete={handleDeleteRole}
              isLoading={isLoading}
            />
          )}
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{editingRole ? 'Edit Role' : 'Create Role'}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowForm(false)
                setEditingRole(null)
              }}
            >
              ✕
            </Button>
          </CardHeader>
          <CardContent>
            {objectSchema && (
              <SchemaForm
                schema={objectSchema}
                initialData={editingRole || {}}
                onSubmit={handleSubmitForm}
              />
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
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
