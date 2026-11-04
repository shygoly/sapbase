'use client'

import React, { useState, useEffect } from 'react'
import { constantsApi } from '@sap/app-shared/lib/api'
import type { FuelTypeRecord } from '@sap/app-shared/lib/api/shipping/types'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Button } from '@sap/app-shared/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { FuelTypeTable } from '@sap/app-shared/components/shipping/fuel-type-management/fuel-type-table'
import { FuelTypeFormDialog } from '@sap/app-shared/components/shipping/fuel-type-management/fuel-type-form-dialog'
import { ConfirmDialog } from '@sap/app-shared/components/ui/confirm-dialog'

function getLocalePrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  const locale = parts[0]
  if (!locale || locale.length > 5) return ''
  return `/${locale}`
}

export default function FuelTypesPage() {
  const pathname = usePathname()
  const localePrefix = getLocalePrefix(pathname ?? '')
  const [items, setItems] = useState<FuelTypeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editItem, setEditItem] = useState<FuelTypeRecord | null>(null)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const notification = useNotification()

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const list = await constantsApi.listFuelTypes()
      setItems(list)
    } catch {
      notification.error('Failed to load fuel types')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleCreate = () => {
    setEditItem(null)
    setShowFormDialog(true)
  }

  const handleEdit = (item: FuelTypeRecord) => {
    setEditItem(item)
    setShowFormDialog(true)
  }

  const handleFormSuccess = () => {
    setShowFormDialog(false)
    setEditItem(null)
    fetchItems()
  }

  const handleDelete = (id: string) => {
    setItemToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    try {
      await constantsApi.deleteFuelType(itemToDelete)
      notification.success('Fuel type deleted successfully')
      fetchItems()
    } catch {
      notification.error('Failed to delete fuel type')
    } finally {
      setItemToDelete(null)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary">Shipping Carbon Master Data</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fuel Type Management</h1>
            <p className="text-sm text-muted-foreground">
              Review and maintain shared fuel parameters available to shipping carbon calculations.
              System fuels are global; tenant fuels are organization-specific.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`${localePrefix}/dashboard/shipping/reports/home-overview`}>
              Back to Overview
            </Link>
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Fuel Type
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
        <FuelTypeTable items={items} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <FuelTypeFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={handleFormSuccess}
        editItem={editItem}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Fuel Type"
        description="Are you sure you want to delete this fuel type? This action cannot be undone. Only tenant fuel types can be deleted."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
