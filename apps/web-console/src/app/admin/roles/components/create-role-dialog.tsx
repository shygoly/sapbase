/**
 * Create Role Dialog Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { rolesApi, permissionsApi, EntityStatus } from '@sap/app-shared/lib/api'
import { Permission } from '@sap/app-shared/lib/api/types'
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
import { Checkbox } from '@sap/app-shared/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

const createRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

type CreateRoleFormData = z.infer<typeof createRoleSchema>

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateRoleDialog({ open, onOpenChange, onSuccess }: CreateRoleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const notification = useNotification()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      status: 'active',
    },
  })

  const getPermissionValue = (permission: Permission) => {
    if (permission.name) return permission.name
    if (permission.resource && permission.action) {
      return `${permission.resource}:${permission.action}`
    }
    return permission.id
  }

  const getPermissionLabel = (permission: Permission) => {
    if (permission.name) return permission.name
    if (permission.resource && permission.action) {
      return `${permission.resource}:${permission.action}`
    }
    return permission.id
  }

  // Fetch permissions
  useEffect(() => {
    if (open) {
      permissionsApi.findAll().then(setPermissions).catch(() => {})
    }
  }, [open])

  const onSubmit = async (data: CreateRoleFormData) => {
    setIsSubmitting(true)
    try {
      const submitData = {
        ...data,
        permissions: selectedPermissions,
        status: data.status ? (data.status as EntityStatus) : undefined,
      }
      await rolesApi.create(submitData)
      notification.success('Role created successfully')
      reset()
      setSelectedPermissions([])
      onOpenChange(false)
      onSuccess()
    } catch {
      notification.error('Failed to create role')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>Add a new role to the system</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Manager"
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
              placeholder="Role description..."
              {...register('description')}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-input p-3">
              {permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No permissions available</p>
              ) : (
                permissions.map((perm) => {
                  const permissionValue = getPermissionValue(perm)
                  const checkboxId = `permission-${perm.id || permissionValue}`
                  const isChecked = selectedPermissions.includes(permissionValue)
                  return (
                    <div key={perm.id || permissionValue} className="flex items-center gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        onCheckedChange={(checked: boolean | 'indeterminate') => {
                          setSelectedPermissions((prev) => {
                            if (checked) {
                              if (prev.includes(permissionValue)) return prev
                              return [...prev, permissionValue]
                            }
                            return prev.filter((value) => value !== permissionValue)
                          })
                        }}
                        disabled={isSubmitting}
                      />
                      <label htmlFor={checkboxId} className="flex-1 cursor-pointer text-sm">
                        {getPermissionLabel(perm)}
                        {perm.description && (
                          <p className="text-xs text-gray-500">{perm.description}</p>
                        )}
                      </label>
                    </div>
                  )
                })
              )}
            </div>
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
              Create Role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
