'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface InlineEditField {
  name: string
  type: 'text' | 'number' | 'email' | 'select' | 'date'
  value: any
  options?: { label: string; value: string }[]
  validation?: (value: any) => string | null
  disabled?: boolean
}

interface InlineEditCellProps {
  field: InlineEditField
  onSave: (value: any) => void
  onCancel: () => void
  isLoading?: boolean
}

export function InlineEditCell({
  field,
  onSave,
  onCancel,
  isLoading = false,
}: InlineEditCellProps) {
  const [value, setValue] = useState(field.value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(field.value)
    setError(null)
  }, [field.value])

  const handleSave = () => {
    const validationError = field.validation?.(value)
    if (validationError) {
      setError(validationError)
      return
    }
    onSave(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const renderInput = () => {
    switch (field.type) {
      case 'select':
        return (
          <Select value={String(value)} onValueChange={setValue}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
            disabled={isLoading || field.disabled}
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
            disabled={isLoading || field.disabled}
          />
        )

      default:
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
            disabled={isLoading || field.disabled}
          />
        )
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {renderInput()}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface InlineEditableProps {
  value: any
  field: Omit<InlineEditField, 'value'>
  onSave: (value: any) => void
  isEditing: boolean
  isLoading?: boolean
  children?: React.ReactNode
}

export function InlineEditable({
  value,
  field,
  onSave,
  isEditing,
  isLoading = false,
  children,
}: InlineEditableProps) {
  if (isEditing) {
    return (
      <InlineEditCell
        field={{ ...field, value }}
        onSave={onSave}
        onCancel={() => {}}
        isLoading={isLoading}
      />
    )
  }

  return <div className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded">{children || value}</div>
}
