'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { DatePicker } from '@/components/ui/date-picker'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  const { register, handleSubmit, formState, watch } = useForm({
    defaultValues: initialData,
  })

  const handleFormSubmit = async (data: Record<string, any>) => {
    // Merge form data with any date picker values
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
        <button
          type="submit"
          disabled={isLoading || formState.isSubmitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading || formState.isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button
          type="reset"
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90"
        >
          Reset
        </button>
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
          <label htmlFor={field.name} className="block text-sm font-medium cursor-pointer">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
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
      <label htmlFor={field.name} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {renderFieldInput(field, register, value, onChange)}

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {errors && errors.length > 0 && (
        <div className="text-xs text-red-500 space-y-1">
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
    ...register(field.name),
  }

  switch (field.type) {
    case 'text':
      return (
        <input
          {...baseProps}
          type="text"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case 'email':
      return (
        <input
          {...baseProps}
          type="email"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case 'password':
      return (
        <input
          {...baseProps}
          type="password"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case 'number':
      return (
        <input
          {...baseProps}
          type="number"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case 'date':
      return (
        <DatePicker
          value={value ? new Date(value) : undefined}
          onValueChange={(date) => onChange?.(date?.toISOString().split('T')[0])}
          placeholder="Select a date"
          disabled={field.readonly}
        />
      )

    case 'datetime':
      return (
        <DatePicker
          value={value ? new Date(value) : undefined}
          onValueChange={(date) => onChange?.(date?.toISOString())}
          placeholder="Select date and time"
          disabled={field.readonly}
        />
      )

    case 'textarea':
      return (
        <textarea
          {...baseProps}
          rows={4}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case 'select':
      return (
        <select
          {...baseProps}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select {field.label}</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
          <input
            {...baseProps}
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-primary"
          />
          <Label htmlFor={field.name} className="font-normal cursor-pointer">
            {field.label}
          </Label>
        </div>
      )

    default:
      return (
        <input
          {...baseProps}
          type="text"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )
  }
}
