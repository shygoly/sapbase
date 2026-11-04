/**
 * Create User Dialog Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi, CreateUserDto } from '@sap/app-shared/lib/api/users.api'
import { rolesApi } from '@sap/app-shared/lib/api/roles.api'
import { UserStatus, Role, Department } from '@sap/app-shared/lib/api/types'
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

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

type CreateUserFormData = z.infer<typeof createUserSchema>

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  departments: Department[]
}

export function CreateUserDialog({ open, onOpenChange, onSuccess, departments }: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const notification = useNotification()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      status: 'active',
      roleId: '',
      departmentId: '',
    },
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

  const onSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true)
    try {
      const submitData: CreateUserDto = {
        ...data,
        departmentId: data.departmentId || undefined,
        status: data.status ? (data.status as UserStatus) : undefined,
      }
      await usersApi.create(submitData)
      notification.success('User created successfully')
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Failed to create user'
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
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>Add a new user to the system</DialogDescription>
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

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              disabled={isSubmitting}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <select
              id="role"
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
              className="w-full rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
