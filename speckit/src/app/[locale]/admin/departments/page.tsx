/**
 * Departments Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { departmentsApi } from '@/lib/api'
import { Department } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { DepartmentsList } from './components/departments-list'
import { CreateDepartmentDialog } from './components/create-department-dialog'
import { EditDepartmentDialog } from './components/edit-department-dialog'
import { TableSkeleton } from '@/components/loading-skeleton'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// PageModel schema
const DepartmentsPageModel: PageModel = {
  id: 'departments-page',
  title: 'Departments Management',
  description: 'Manage organizational departments',
  permissions: ['departments:read'],
}

// CollectionModel schema
const DepartmentsCollectionModel: CollectionModel = {
  id: 'departments-collection',
  name: 'Departments',
  permissions: ['departments:read'],
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(null)
  const notification = useNotification()

  // Fetch departments
  const fetchDepartments = async () => {
    setIsLoading(true)
    try {
      const result = await departmentsApi.findAll(page, pageSize)
      setDepartments(result.data || [])
      setTotal(result.total || 0)
    } catch (error) {
      notification.error('Failed to load departments')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run on page/pageSize change
  }, [page, pageSize])

  const handleCreateDepartment = async () => {
    setShowCreateDialog(false)
    setPage(1)
    await fetchDepartments()
    notification.success('Department created successfully')
  }

  const handleDeleteDepartment = async (id: string) => {
    setDepartmentToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDeleteDepartment = async () => {
    if (!departmentToDelete) return

    try {
      await departmentsApi.delete(departmentToDelete)
      notification.success('Department deleted successfully')
      await fetchDepartments()
    } catch {
      notification.error('Failed to delete department')
    } finally {
      setDepartmentToDelete(null)
    }
  }

  const handleEditDepartment = (department: Department) => {
    setSelectedDepartment(department)
    setShowEditDialog(true)
  }

  const handleUpdateDepartment = async () => {
    setShowEditDialog(false)
    setSelectedDepartment(null)
    await fetchDepartments()
    notification.success('Department updated successfully')
  }

  const pageHeaderAction = (
    <PermissionGuard permission="departments:create">
      <Button onClick={() => setShowCreateDialog(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Department
      </Button>
    </PermissionGuard>
  )

  return (
    <PageRuntime model={DepartmentsPageModel} isLoading={isLoading} pageHeaderAction={pageHeaderAction}>
      <div className="space-y-6">
        {/* Departments Table */}
        <CollectionRuntime model={DepartmentsCollectionModel} isLoading={isLoading}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <DepartmentsList
              departments={departments}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onDelete={handleDeleteDepartment}
              onEdit={handleEditDepartment}
            />
          )}
        </CollectionRuntime>

        {/* Create Department Dialog */}
        <CreateDepartmentDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateDepartment}
        />

        {/* Edit Department Dialog */}
        <EditDepartmentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={handleUpdateDepartment}
          department={selectedDepartment}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={confirmDeleteDepartment}
          title="Delete Department"
          description="Are you sure you want to delete this department? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </PageRuntime>
  )
}
