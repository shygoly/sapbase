/**
 * Edit Department Dialog Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { departmentsApi, EntityStatus } from '@sap/app-shared/lib/api'
import { Department } from '@sap/app-shared/lib/api/types'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sap/app-shared/components/ui/dialog'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import { Loader2 } from 'lucide-react'

const editDepartmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

type EditDepartmentFormData = z.infer<typeof editDepartmentSchema>

interface EditDepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  department: Department | null
}

export function EditDepartmentDialog({
  open,
  onOpenChange,
  onSuccess,
  department,
}: EditDepartmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const notification = useNotification()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditDepartmentFormData>({
    resolver: zodResolver(editDepartmentSchema),
  })

  // Initialize form when department changes
  useEffect(() => {
    if (open && department) {
      reset({
        name: department.name,
        description: department.description || '',
        parentId: department.parentId || '',
        status: department.status as 'active' | 'inactive' | 'archived',
      })
    }
  }, [open, department, reset])

  const onSubmit = async (data: EditDepartmentFormData) => {
    if (!department) return

    setIsSubmitting(true)
    try {
      const submitData = {
        ...data,
        status: data.status ? (data.status as EntityStatus) : undefined,
      }
      await departmentsApi.update(department.id, submitData)
      notification.success('Department updated successfully')
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      notification.error('Failed to update department')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>Update department information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Engineering"
              {...register('name')}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              placeholder="Department description..."
              {...register('description')}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              {...register('status')}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Department
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
