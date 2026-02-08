'use client'

import { useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
import { SchemaList } from '@/components/schema-list'
import { schemaResolver } from '@/core/schema/resolver'
import { schemaRegistry } from '@/core/schema/registry'
import { apiService } from '@/lib/api-service'
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
        console.error('Failed to load data:', err)
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
      console.error('Failed to delete department:', err)
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
      console.error('Failed to save department:', err)
      setError(err instanceof Error ? err.message : 'Failed to save department')
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
        <div className="space-y-4">
          <Button onClick={handleCreateDept}>Create Department</Button>
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
      ) : (
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
    </div>
  )
}
