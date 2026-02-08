import type {
  ObjectSchema,
  ViewSchema,
  PageSchema,
  FieldDefinition,
  ValidationRule,
} from './types'

export class SchemaValidator {
  /**
   * Validate an object schema
   */
  validateObjectSchema(schema: any): schema is ObjectSchema {
    if (!schema || typeof schema !== 'object') return false
    if (!schema.name || typeof schema.name !== 'string') return false
    if (!schema.label || typeof schema.label !== 'string') return false
    if (!Array.isArray(schema.fields)) return false

    return schema.fields.every((field: any) => this.isValidField(field))
  }

  /**
   * Validate a view schema
   */
  validateViewSchema(schema: any): schema is ViewSchema {
    if (!schema || typeof schema !== 'object') return false
    if (!schema.name || typeof schema.name !== 'string') return false
    if (!['list', 'form', 'detail', 'dashboard'].includes(schema.type)) return false
    if (!schema.object || typeof schema.object !== 'string') return false

    return true
  }

  /**
   * Validate a page schema
   */
  validatePageSchema(schema: any): schema is PageSchema {
    if (!schema || typeof schema !== 'object') return false
    if (!schema.path || typeof schema.path !== 'string') return false
    if (!schema.view || typeof schema.view !== 'string') return false

    return true
  }

  /**
   * Validate a field definition
   */
  private isValidField(field: any): field is FieldDefinition {
    if (!field || typeof field !== 'object') return false
    if (!field.name || typeof field.name !== 'string') return false
    if (!field.label || typeof field.label !== 'string') return false
    if (
      ![
        'text',
        'number',
        'email',
        'password',
        'select',
        'multiselect',
        'checkbox',
        'date',
        'datetime',
        'textarea',
        'relation',
        'file',
      ].includes(field.type)
    ) {
      return false
    }

    if (field.validation && !Array.isArray(field.validation)) {
      return false
    }

    return true
  }

  /**
   * Validate field value against validation rules
   */
  validateFieldValue(
    value: any,
    field: FieldDefinition
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field.label} is required`)
      return { valid: false, errors }
    }

    if (!field.validation || field.validation.length === 0) {
      return { valid: errors.length === 0, errors }
    }

    // Check validation rules
    for (const rule of field.validation) {
      const error = this.validateRule(value, rule, field)
      if (error) {
        errors.push(error)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Validate a single rule
   */
  private validateRule(
    value: any,
    rule: ValidationRule,
    field: FieldDefinition
  ): string | null {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return rule.message || `${field.label} is required`
        }
        return null

      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message || `${field.label} must be at least ${rule.value}`
        }
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message || `${field.label} must be at least ${rule.value} characters`
        }
        return null

      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message || `${field.label} must be at most ${rule.value}`
        }
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message || `${field.label} must be at most ${rule.value} characters`
        }
        return null

      case 'pattern':
        if (typeof value === 'string') {
          const regex = new RegExp(rule.value)
          if (!regex.test(value)) {
            return rule.message || `${field.label} format is invalid`
          }
        }
        return null

      case 'custom':
        // Custom validation would be handled by callback
        return null

      default:
        return null
    }
  }

  /**
   * Validate form data against object schema
   */
  validateFormData(
    data: Record<string, any>,
    schema: ObjectSchema
  ): { valid: boolean; errors: Record<string, string[]> } {
    const errors: Record<string, string[]> = {}

    for (const field of schema.fields) {
      const value = data[field.name]
      const validation = this.validateFieldValue(value, field)

      if (!validation.valid) {
        errors[field.name] = validation.errors
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    }
  }
}

export const schemaValidator = new SchemaValidator()
