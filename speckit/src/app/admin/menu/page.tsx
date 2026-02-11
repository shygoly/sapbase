'use client'

import React, { useState, useEffect } from 'react'
import { usePermissionStore } from '@/core/store'
import { menuApi } from '@/lib/api/menu.api'
import { MenuItem } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { MenuList } from './components/menu-list'
import { CreateMenuDialog } from './components/create-menu-dialog'
import { EditMenuDialog } from './components/edit-menu-dialog'

export default function MenuPage() {
  const { hasPermission } = usePermissionStore()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

  useEffect(() => {
    loadMenuItems()
  }, [])

  const loadMenuItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const items = await menuApi.findAll()
      setMenuItems(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load menu items')
    } finally {
      setLoading(false)
    }
  }

  // Check permissions - after all hooks
  if (!hasPermission('menu:read')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  const handleCreate = async (data: any) => {
    try {
      await menuApi.create(data)
      await loadMenuItems()
      setShowCreateDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create menu item')
    }
  }

  const handleUpdate = async (id: string, data: any) => {
    try {
      await menuApi.update(id, data)
      await loadMenuItems()
      setEditingItem(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menu item')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return
    try {
      await menuApi.delete(id)
      await loadMenuItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete menu item')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="mt-1 text-gray-600">Manage application menu items and navigation structure</p>
        </div>
        {hasPermission('menu:create') && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Menu Item
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Menu List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading menu items...</div>
        </div>
      ) : (
        <MenuList
          items={menuItems}
          onEdit={setEditingItem}
          onDelete={handleDelete}
          canEdit={hasPermission('menu:update')}
          canDelete={hasPermission('menu:delete')}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateMenuDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreate}
          allItems={menuItems}
        />
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <EditMenuDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdate={handleUpdate}
          allItems={menuItems}
        />
      )}
    </div>
  )
}
