/**
 * Edit User Dialog Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi, UpdateUserDto } from '@sap/app-shared/lib/api/users.api'
import { rolesApi } from '@sap/app-shared/lib/api/roles.api'
import { User, UserStatus, Role, Department } from '@sap/app-shared/lib/api/types'
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

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

type EditUserFormData = z.infer<typeof editUserSchema>

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  user: User | null
  departments: Department[]
}

export function EditUserDialog({ open, onOpenChange, onSuccess, user, departments }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const notification = useNotification()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  })

  // Fetch roles when dialog opens
  useEffect(() => {
    if (open) {
      const fetchRoles = async () => {
        try {
          const rolesData = await rolesApi.findAll()
          setRoles(rolesData)
        } catch (error) {
          notification.error('Failed to load roles')
        } finally {
          setIsLoadingRoles(false)
        }
      }
      fetchRoles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        roleId: user.roleId || '',
        departmentId: user.departmentId || '',
        status: user.status as UserStatus,
      })
    }
  }, [user, reset])

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      const submitData: UpdateUserDto = {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        departmentId: data.departmentId || undefined,
        status: data.status ? (data.status as UserStatus) : undefined,
      }

      await usersApi.update(user.id, submitData)
      notification.success('User updated successfully')
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Failed to update user'
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message
        // Handle array of validation errors
        if (Array.isArray(backendMessage)) {
          errorMessage = backendMessage.join(', ')
        } else {
          errorMessage = backendMessage
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      notification.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              {...register('name')}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <select
              id="roleId"
              {...register('roleId')}
              disabled={isSubmitting || isLoadingRoles}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleId && <p className="text-sm text-red-500">{errors.roleId.message}</p>}
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="departmentId">Department (Optional)</Label>
            <select
              id="departmentId"
              {...register('departmentId')}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
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
              <option value="suspended">Suspended</option>
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
              Update User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
