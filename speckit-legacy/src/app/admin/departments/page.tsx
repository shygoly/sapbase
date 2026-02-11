'use client'

import { useMemo, useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
import { SchemaList } from '@/components/schema-list'
import { BatchOperations } from '@/components/batch-operations'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { CollectionRuntime } from '@/components/runtime/collection-runtime'
import { FormRuntime } from '@/components/runtime/form-runtime'
import { buildPageModel, toCollectionSchema, toFormSchema } from '@/components/runtime/schema-adapters'
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

export default function DepartmentsPage() {
  const [pageSchema, setPageSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [departments, setDepartments] = useState<Record<string, any>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDept, setEditingDept] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, any> | null>(null)
  const [selectedDepts, setSelectedDepts] = useState<Record<string, any>[]>([])

  const pageModel = useMemo(() => {
    return buildPageModel({
      id: 'admin-departments',
      path: '/admin/departments',
      fallbackTitle: 'Departments',
      fallbackDescription: 'Department management',
      pageSchema,
    })
  }, [pageSchema])

  const collectionSchema = useMemo(() => {
    return objectSchema
      ? toCollectionSchema(objectSchema, pageSchema)
      : { id: 'departments-collection', title: 'Departments', columns: [] }
  }, [objectSchema, pageSchema])

  const formSchema = useMemo(() => {
    return objectSchema
      ? toFormSchema(objectSchema)
      : { id: 'department-form', title: 'Department', fields: [] }
  }, [objectSchema])

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const resolved = await schemaResolver.resolvePage('departments')
        setPageSchema(resolved)
        const objSchema = schemaRegistry.getObject('department')
        if (objSchema) setObjectSchema(objSchema)
        const data = await apiService.getDepartments()
        setDepartments(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleCreateDept = () => {
    setEditingDept(null)
    setShowForm(true)
  }

  const handleEditDept = (dept: Record<string, any>) => {
    setEditingDept(dept)
    setShowForm(true)
  }

  const handleDeleteDept = (dept: Record<string, any>) => {
    setDeleteConfirm(dept)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await apiService.deleteDepartment(deleteConfirm.id)
      setDepartments(departments.filter(d => d.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department')
    }
  }

  const handleSubmitForm = async (data: Record<string, any>) => {
    try {
      let result: Record<string, any>
      if (editingDept) {
        result = await apiService.updateDepartment(editingDept.id, data)
        setDepartments(departments.map(d => (d.id === result.id ? result : d)))
      } else {
        result = await apiService.createDepartment(data)
        setDepartments([...departments, result])
      }
      setShowForm(false)
      setEditingDept(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedDepts.map(d => apiService.deleteDepartment(d.id)))
      setDepartments(departments.filter(d => !selectedDepts.find(sd => sd.id === d.id)))
      setSelectedDepts([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete departments')
    }
  }

  const handleBatchExport = async () => {
    try {
      const dataToExport = selectedDepts.length > 0 ? selectedDepts : departments
      exportService.exportToCSV(
        dataToExport,
        ['id', 'name', 'description'] as const,
        { filename: 'departments' }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export departments')
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
            <BreadcrumbPage>Departments</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {pageSchema?.metadata?.title || 'Departments'}
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
        <CollectionRuntime schema={collectionSchema} data={departments} isLoading={isLoading}>
          <div className="space-y-4">
            <Button onClick={handleCreateDept}>Create Department</Button>

            <BatchOperations
              selectedCount={selectedDepts.length}
              onDelete={selectedDepts.length > 0 ? handleBatchDelete : undefined}
              onExport={handleBatchExport}
              onClearSelection={() => setSelectedDepts([])}
              isLoading={isLoading}
            />

            {objectSchema && (
              <SchemaList
                schema={objectSchema}
                data={departments}
                onEdit={handleEditDept}
                onDelete={handleDeleteDept}
                isLoading={isLoading}
              />
            )}
          </div>
        </CollectionRuntime>
      ) : (
        <FormRuntime schema={formSchema}>
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>
                {editingDept ? 'Edit Department' : 'Create Department'}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowForm(false)
                  setEditingDept(null)
                }}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              {objectSchema && (
                <SchemaForm
                  schema={objectSchema}
                  initialData={editingDept || {}}
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
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
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
