'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Upload, X, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface FileUploadProps {
  label?: string
  accept?: string
  maxSize?: number // in MB
  value?: string | null
  onChange?: (url: string | null) => void
  onUpload?: (file: File) => Promise<string>
  preview?: boolean
  className?: string
}

export function FileUpload({
  label = 'Upload File',
  accept = 'image/*',
  maxSize = 5,
  value,
  onChange,
  onUpload,
  preview = true,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `File size must be less than ${maxSize}MB`,
        variant: 'destructive',
      })
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file if handler provided
    if (onUpload) {
      try {
        setUploading(true)
        const url = await onUpload(file)
        setPreviewUrl(url)
        onChange?.(url)
        toast({
          title: 'Success',
          description: 'File uploaded successfully',
        })
      } catch (error: any) {
        toast({
          title: 'Upload failed',
          description: error.message || 'Failed to upload file',
          variant: 'destructive',
        })
        setPreviewUrl(value || null)
      } finally {
        setUploading(false)
      }
    } else {
      // Just update preview if no upload handler
      onChange?.(URL.createObjectURL(file))
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-2 space-y-4">
        {preview && previewUrl && (
          <div className="relative inline-block">
            <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-contain"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {previewUrl ? 'Change File' : 'Choose File'}
              </>
            )}
          </Button>
          {previewUrl && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Max file size: {maxSize}MB. Supported formats: PNG, JPG, GIF, SVG, ICO
        </p>
      </div>
    </div>
  )
}
