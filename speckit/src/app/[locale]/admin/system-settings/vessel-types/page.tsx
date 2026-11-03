'use client'

import React, { useState, useEffect } from 'react'
import { constantsApi } from '@/lib/api'
import type { CiiShipTypeParameterRecord } from '@/lib/api/shipping/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { VesselTypeTable } from '@/components/shipping/vessel-type-management/vessel-type-table'
import { VesselTypeFormDialog } from '@/components/shipping/vessel-type-management/vessel-type-form-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function getLocalePrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  const locale = parts[0]
  if (!locale || locale.length > 5) return ''
  return `/${locale}`
}

export default function VesselTypesPage() {
  const pathname = usePathname()
  const localePrefix = getLocalePrefix(pathname ?? '')
  const [items, setItems] = useState<CiiShipTypeParameterRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editItem, setEditItem] = useState<CiiShipTypeParameterRecord | null>(null)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const notification = useNotification()

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const list = await constantsApi.listCiiShipTypes()
      setItems(list)
    } catch {
      notification.error('Failed to load vessel types')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = () => {
    setEditItem(null)
    setShowFormDialog(true)
  }

  const handleEdit = (item: CiiShipTypeParameterRecord) => {
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
      await constantsApi.deleteCiiShipType(itemToDelete)
      notification.success('Vessel type deleted successfully')
      fetchItems()
    } catch {
      notification.error('Failed to delete vessel type')
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
            <h1 className="text-2xl font-semibold tracking-tight">Vessel Type Management</h1>
            <p className="text-sm text-muted-foreground">
              Maintain CII ship type parameters used by the shipping carbon calculation domain.
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
            Create Vessel Type
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : (
        <VesselTypeTable items={items} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <VesselTypeFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={handleFormSuccess}
        editItem={editItem}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Vessel Type"
        description="Are you sure you want to delete this vessel type parameter? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
