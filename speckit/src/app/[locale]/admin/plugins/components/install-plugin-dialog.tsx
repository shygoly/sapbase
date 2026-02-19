/**
 * Install Plugin Dialog Component
 */

'use client'

import React, { useState } from 'react'
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
import { Upload, Loader2 } from 'lucide-react'

interface InstallPluginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function InstallPluginDialog({
  open,
  onOpenChange,
  onSuccess,
}: InstallPluginDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.zip')) {
        setError('Please select a ZIP file')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleInstall = async () => {
    if (!file) {
      setError('Please select a plugin ZIP file')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const { pluginsApi } = await import('@/lib/api')
      await pluginsApi.install(file)
      setFile(null)
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to install plugin',
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Plugin</DialogTitle>
          <DialogDescription>
            Upload a plugin ZIP file to install it in your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="plugin-file">Plugin ZIP File</Label>
            <div className="mt-2">
              <Input
                id="plugin-file"
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button onClick={handleInstall} disabled={!file || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Install
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
