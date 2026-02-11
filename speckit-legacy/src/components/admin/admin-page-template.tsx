'use client'

import { useState, useMemo } from 'react'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { CollectionRuntime } from '@/components/runtime/collection-runtime'
import { FormRuntime } from '@/components/runtime/form-runtime'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EnhancedBatchOperations, type BatchAction } from '@/components/ui/table/enhanced-batch-operations'
import type { ResolvedPageSchema, ObjectSchema } from '@/core/schema/types'

export interface AdminPageTemplateProps {
  pageModel: any
  pageSchema: ResolvedPageSchema | null
  objectSchema: ObjectSchema | null
  data: Record<string, any>[]
  isLoading: boolean
  error: string | null
  showForm: boolean
  editingItem: Record<string, any> | null
  selectedItems: Record<string, any>[]
  deleteConfirm: Record<string, any> | null

  onCreateClick: () => void
  onEditClick: (item: Record<string, any>) => void
  onDeleteClick: (item: Record<string, any>) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onFormSubmit: (data: Record<string, any>) => void
  onFormCancel: () => void
  onBatchDelete: () => void
  onBatchExport: () => void
  onSelectionChange: (items: Record<string, any>[]) => void
  onClearSelection: () => void

  renderTable: (props: {
    data: Record<string, any>[]
    selectedItems: Record<string, any>[]
    onEdit: (item: Record<string, any>) => void
    onDelete: (item: Record<string, any>) => void
    onSelectionChange: (items: Record<string, any>[]) => void
  }) => React.ReactNode

  renderForm?: (props: {
    schema: ObjectSchema
    initialData: Record<string, any>
    onSubmit: (data: Record<string, any>) => void
  }) => React.ReactNode

  title?: string
  description?: string
  createButtonLabel?: string
}

export function AdminPageTemplate({
  pageModel,
  pageSchema,
  objectSchema,
  data,
  isLoading,
  error,
  showForm,
  editingItem,
  selectedItems,
  deleteConfirm,

  onCreateClick,
  onEditClick,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onFormSubmit,
  onFormCancel,
  onBatchDelete,
  onBatchExport,
  onSelectionChange,
  onClearSelection,

  renderTable,
  renderForm,

  title,
  description,
  createButtonLabel = 'Create',
}: AdminPageTemplateProps) {
  const batchActions: BatchAction[] = useMemo(() => {
    const actions: BatchAction[] = [
      {
        id: 'export',
        label: 'Export',
        icon: undefined,
        onClick: onBatchExport,
      },
    ]

    if (selectedItems.length > 0) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        variant: 'destructive',
        onClick: onBatchDelete,
      })
    }

    return actions
  }, [selectedItems.length, onBatchExport, onBatchDelete])

  if (isLoading && data.length === 0) {
    return (
      <PageRuntime model={pageModel} className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </PageRuntime>
    )
  }

  return (
    <PageRuntime model={pageModel} className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {title || pageSchema?.metadata?.title || 'Items'}
        </h1>
        <p className="text-muted-foreground">
          {description || pageSchema?.metadata?.description}
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!showForm ? (
        <CollectionRuntime schema={{ id: 'collection', title: 'Items', columns: [] }} data={data}>
          <div className="space-y-4">
            <Button onClick={onCreateClick}>{createButtonLabel}</Button>

            <EnhancedBatchOperations
              selectedCount={selectedItems.length}
              totalCount={data.length}
              actions={batchActions}
              onClearSelection={onClearSelection}
              isLoading={isLoading}
            />

            {renderTable({
              data,
              selectedItems,
              onEdit: onEditClick,
              onDelete: onDeleteClick,
              onSelectionChange,
            })}
          </div>
        </CollectionRuntime>
      ) : (
        <FormRuntime schema={{ id: 'form', title: 'Form', fields: [] }}>
          <Card className="max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{editingItem ? 'Edit' : 'Create'}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onFormCancel}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              {objectSchema && renderForm ? (
                renderForm({
                  schema: objectSchema,
                  initialData: editingItem || {},
                  onSubmit: onFormSubmit,
                })
              ) : (
                <p className="text-muted-foreground">Form not configured</p>
              )}
            </CardContent>
          </Card>
        </FormRuntime>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && onCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageRuntime>
  )
}
