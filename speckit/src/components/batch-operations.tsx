'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

interface BatchOperationsProps {
  selectedCount: number
  onDelete?: () => Promise<void>
  onExport?: () => Promise<void>
  onSelectAll?: () => void
  onClearSelection?: () => void
  isLoading?: boolean
}

export function BatchOperations({
  selectedCount,
  onDelete,
  onExport,
  onSelectAll,
  onClearSelection,
  isLoading = false,
}: BatchOperationsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return
    setIsProcessing(true)
    try {
      await onDelete()
      setShowDeleteConfirm(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExport = async () => {
    if (!onExport) return
    setIsProcessing(true)
    try {
      await onExport()
    } finally {
      setIsProcessing(false)
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <Checkbox checked={true} disabled className="cursor-default" />
        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="flex gap-2 ml-auto">
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={isLoading || isProcessing}
            >
              Select All
            </Button>
          )}

          {onClearSelection && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading || isProcessing}
            >
              Clear
            </Button>
          )}

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isLoading || isProcessing}
            >
              Export
            </Button>
          )}

          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading || isProcessing}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} item{selectedCount !== 1 ? 's' : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
