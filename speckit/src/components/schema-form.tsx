'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { ObjectSchema, FieldDefinition } from '@/core/schema/types'
import { schemaValidator } from '@/core/schema/validator'

interface SchemaFormProps {
  schema: ObjectSchema
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => Promise<void>
  isLoading?: boolean
}

export function SchemaForm({
  schema,
  initialData = {},
  onSubmit,
  isLoading = false,
}: SchemaFormProps) {
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formData, setFormData] = useState(initialData)
  const { register, handleSubmit, formState } = useForm({
    defaultValues: initialData,
  })

  const handleFormSubmit = async (data: Record<string, any>) => {
    // Merge form data with any controlled values
    const finalData = { ...data, ...formData }

    // Validate form data
    const validation = schemaValidator.validateFormData(finalData, schema)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    setErrors({})
    try {
      await onSubmit(finalData)
    } catch (error) {
      return
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {schema.fields.map(field => (
        <FormField
          key={field.name}
          field={field}
          register={register}
          errors={errors[field.name]}
          value={formData[field.name]}
          onChange={(value) => setFormData(prev => ({ ...prev, [field.name]: value }))}
        />
      ))}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isLoading || formState.isSubmitting}
        >
          {isLoading || formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
        <Button
          type="reset"
          variant="outline"
        >
          Reset
        </Button>
      </div>
    </form>
  )
}

interface FormFieldProps {
  field: FieldDefinition
  register: any
  errors?: string[]
  value?: any
  onChange?: (value: any) => void
}

function FormField({ field, register, errors, value, onChange }: FormFieldProps) {
  if (field.hidden) return null

  // Special handling for Switch component (checkbox fields with displayAs: 'switch')
  if (field.type === 'checkbox' && field.displayAs === 'switch') {
    return (
      <div className="flex items-center justify-between space-x-3 p-3 border rounded-lg">
        <div>
          <Label htmlFor={field.name} className="cursor-pointer">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
          )}
        </div>
        <Switch
          id={field.name}
          checked={value || false}
          onCheckedChange={onChange}
          disabled={field.readonly}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {renderFieldInput(field, register, value, onChange)}

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {errors && errors.length > 0 && (
        <div className="text-xs text-destructive space-y-1">
          {errors.map((error, idx) => (
            <p key={idx}>{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function renderFieldInput(field: FieldDefinition, register: any, value?: any, onChange?: (value: any) => void) {
  const baseProps = {
    id: field.name,
    placeholder: field.placeholder,
    disabled: field.readonly,
  }

  switch (field.type) {
    case 'text':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="text"
        />
      )

    case 'email':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="email"
        />
      )

    case 'password':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="password"
        />
      )

    case 'number':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="number"
        />
      )

    case 'date':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="date"
          value={value ? (typeof value === 'string' ? value.split('T')[0] : new Date(value).toISOString().split('T')[0]) : ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )

    case 'datetime':
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="datetime-local"
          value={value ? (typeof value === 'string' ? value.slice(0, 16) : new Date(value).toISOString().slice(0, 16)) : ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )

    case 'textarea':
      return (
        <Textarea
          {...baseProps}
          {...register(field.name)}
          rows={4}
        />
      )

    case 'select':
      return (
        <Select
          value={value || ''}
          onValueChange={onChange}
          disabled={field.readonly}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'checkbox':
      // Use Switch if displayAs is set to 'switch', otherwise use traditional checkbox
      if (field.displayAs === 'switch') {
        return (
          <Switch
            checked={value || false}
            onCheckedChange={onChange}
            disabled={field.readonly}
          />
        )
      }
      // Default to traditional checkbox
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.name}
            checked={value || false}
            onCheckedChange={onChange}
            disabled={field.readonly}
            {...register(field.name)}
          />
          <Label htmlFor={field.name} className="font-normal cursor-pointer">
            {field.label}
          </Label>
        </div>
      )

    default:
      return (
        <Input
          {...baseProps}
          {...register(field.name)}
          type="text"
        />
      )
  }
}
