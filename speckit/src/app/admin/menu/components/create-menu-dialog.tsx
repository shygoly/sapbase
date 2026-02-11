'use client'

import React, { useState } from 'react'
import { MenuItem } from '@/lib/api/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CreateMenuDialogProps {
  onClose: () => void
  onCreate: (data: any) => Promise<void>
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

export function CreateMenuDialog({
  onClose,
  onCreate,
  allItems,
}: CreateMenuDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    label: '',
    path: '',
    icon: '',
    visible: true,
    order: 0,
    parentId: '',
    permissions: [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.label.trim()) {
      alert('Label is required')
      return
    }

    try {
      setLoading(true)
      await onCreate(formData)
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

  const parentItems = allItems.filter((item) => !item.parent)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Menu Item</DialogTitle>
          <DialogDescription>
            Add a new menu item to the navigation structure
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
                <SelectItem value="">No parent (top-level)</SelectItem>
                {parentItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
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
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
