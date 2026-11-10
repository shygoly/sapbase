'use client'

import React, { useState } from 'react'
import { MenuItem } from '@sap/app-shared/lib/api/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'

interface EditMenuDialogProps {
  item: MenuItem
  onClose: () => void
  onUpdate: (id: string, data: any) => Promise<void>
  allItems: MenuItem[]
}

const ICON_OPTIONS = [
  'dashboard',
  'users',
  'menu',
  'building',
  'shield',
  'history',
  'settings',
  'chart',
  'analytics',
  'user',
  'lock',
]

const NO_PARENT_VALUE = '__NO_PARENT__'

export function EditMenuDialog({
  item,
  onClose,
  onUpdate,
  allItems,
}: EditMenuDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    label: item.label,
    path: item.path || '',
    icon: item.icon || '',
    visible: item.visible,
    order: item.order,
    parentId: item.parent?.id || NO_PARENT_VALUE,
    permissions: item.permissions || [],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.label.trim()) {
      alert('Label is required')
      return
    }

    try {
      setLoading(true)
      const payload = {
        ...formData,
        parentId: formData.parentId === NO_PARENT_VALUE ? undefined : formData.parentId,
      }
      await onUpdate(item.id, payload)
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }))
  }

  const parentItems = allItems.filter((i) => i.id !== item.id && !i.parent)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Menu Item</DialogTitle>
          <DialogDescription>
            Update the menu item details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="Menu item label"
              required
            />
          </div>

          {/* Path */}
          <div className="space-y-2">
            <Label htmlFor="path">Path</Label>
            <Input
              id="path"
              value={formData.path}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, path: e.target.value }))
              }
              placeholder="/admin/users"
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label htmlFor="icon">Icon</Label>
            <Select value={formData.icon} onValueChange={(value: string) =>
              setFormData((prev) => ({ ...prev, icon: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select icon" />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parent */}
          <div className="space-y-2">
            <Label htmlFor="parent">Parent Item</Label>
            <Select value={formData.parentId} onValueChange={(value: string) =>
              setFormData((prev) => ({ ...prev, parentId: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="No parent (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT_VALUE}>No parent (top-level)</SelectItem>
                {parentItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Order */}
          <div className="space-y-2">
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              value={formData.order}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  order: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>

          {/* Visible */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="visible"
              checked={formData.visible}
              onCheckedChange={(checked: boolean) =>
                setFormData((prev) => ({ ...prev, visible: checked }))
              }
            />
            <Label htmlFor="visible">Visible</Label>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="space-y-2">
              {['users:read', 'menu:read', 'departments:read', 'roles:read', 'audit-logs:read', 'system:manage'].map(
                (permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission}
                      checked={formData.permissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                    />
                    <Label htmlFor={permission} className="font-normal">
                      {permission}
                    </Label>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
