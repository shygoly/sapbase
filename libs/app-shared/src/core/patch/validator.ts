/* eslint-disable @typescript-eslint/no-unused-vars -- reserved params for API consistency */
// Patch validator with security rules and constraint checking
import type {
  Patch,
  PatchValidationResult,
  SecurityLevel,
} from './types'
import { SchemaRegistry } from '../schema/registry'

/**
 * System core fields that cannot be deleted or modified
 */
const SYSTEM_CORE_FIELDS = ['id', 'createdAt', 'updatedAt', 'version']

/**
 * Valid component registry (extendable)
 */
const COMPONENT_REGISTRY = [
  'TextInput',
  'NumberInput',
  'EmailInput',
  'PasswordInput',
  'Select',
  'MultiSelect',
  'Checkbox',
  'DatePicker',
  'DateTimePicker',
  'Textarea',
  'FileUpload',
  'DateColumn',
  'TextColumn',
  'NumberColumn',
  'BooleanColumn',
]

/**
 * Valid field types
 */
const VALID_FIELD_TYPES = [
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
]

/**
 * Patch validator with security rules
 */
export class PatchValidator {
  private schemaRegistry: SchemaRegistry

  constructor(schemaRegistry: SchemaRegistry) {
    this.schemaRegistry = schemaRegistry
  }

  /**
   * Validate a patch and return validation result
   */
  validate(patch: Patch, actorPermissions?: string[]): PatchValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic structure validation
    this.validateStructure(patch, errors)

    // Scope-specific validation
    switch (patch.scope) {
      case 'page':
        this.validatePagePatch(patch, errors, warnings)
        break
      case 'object':
        this.validateObjectPatch(patch, errors, warnings)
        break
      case 'permission':
        this.validatePermissionPatch(patch, errors, warnings, actorPermissions)
        break
      case 'state':
        this.validateStatePatch(patch, errors, warnings)
        break
      case 'menu':
        this.validateMenuPatch(patch, errors, warnings)
        break
    }

    // Security level assignment
    const securityLevel = this.assignSecurityLevel(patch, errors)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      securityLevel,
    }
  }

  /**
   * Validate patch structure
   */
  private validateStructure(patch: Patch, errors: string[]): void {
    if (!patch.version || patch.version !== '1.0') {
      errors.push('Patch version must be "1.0"')
    }

    if (!patch.patchId || !this.isValidUUID(patch.patchId)) {
      errors.push('Patch must have a valid UUID patchId')
    }

    if (!patch.timestamp || !this.isValidISO8601(patch.timestamp)) {
      errors.push('Patch must have a valid ISO-8601 timestamp')
    }

    if (!['ai', 'human'].includes(patch.actor)) {
      errors.push('Patch actor must be "ai" or "human"')
    }

    if (!patch.target || !patch.target.type || !patch.target.identifier) {
      errors.push('Patch must have a valid target with type and identifier')
    }

    if (!patch.payload || typeof patch.payload !== 'object') {
      errors.push('Patch must have a valid payload object')
    }
  }

  /**
   * Validate page scope patch
   */
  private validatePagePatch(
    patch: Patch,
    errors: string[],
    _warnings: string[]
  ): void {
    const payload = patch.payload as any

    // Check if page exists
    if (patch.operation !== 'add') {
      const pageSchema = this.schemaRegistry.getPage(patch.target.identifier)
      if (!pageSchema) {
        errors.push(`Page "${patch.target.identifier}" does not exist`)
      }
    }

    // Validate field modifications
    if (payload.field) {
      if (patch.operation === 'remove' && payload.field.name) {
        if (SYSTEM_CORE_FIELDS.includes(payload.field.name)) {
          errors.push(`Cannot remove system core field: ${payload.field.name}`)
        }
      }

      if (payload.field.component && !COMPONENT_REGISTRY.includes(payload.field.component)) {
        errors.push(`Invalid component: ${payload.field.component}. Must be from component registry.`)
      }
    }

    // Validate action modifications
    if (payload.action) {
      if (!['primary', 'secondary', 'danger'].includes(payload.action.type)) {
        errors.push('Action type must be "primary", "secondary", or "danger"')
      }
    }
  }

  /**
   * Validate object scope patch
   */
  private validateObjectPatch(
    patch: Patch,
    errors: string[],
    _warnings: string[]
  ): void {
    const payload = patch.payload as any

    // Check if object exists
    if (patch.operation !== 'add' && patch.target.type === 'object') {
      const objectSchema = this.schemaRegistry.getObject(patch.target.identifier)
      if (!objectSchema) {
        errors.push(`Object "${patch.target.identifier}" does not exist`)
      }
    }

    // Validate field modifications
    if (payload.field) {
      // System field protection
      if (
        (patch.operation === 'remove' || patch.operation === 'update') &&
        SYSTEM_CORE_FIELDS.includes(payload.field.name)
      ) {
        errors.push(`Cannot ${patch.operation} system core field: ${payload.field.name}`)
      }

      // Field type validation
      if (payload.field.type && !VALID_FIELD_TYPES.includes(payload.field.type)) {
        errors.push(`Invalid field type: ${payload.field.type}`)
      }

      // Component validation
      if (payload.field.component && !COMPONENT_REGISTRY.includes(payload.field.component)) {
        errors.push(`Invalid component: ${payload.field.component}`)
      }

      // Reference integrity for relation fields
      if (payload.field.type === 'relation') {
        if (!payload.field.relationObject) {
          errors.push('Relation fields must specify relationObject')
        } else {
          const targetObject = this.schemaRegistry.getObject(payload.field.relationObject)
          if (!targetObject) {
            errors.push(`Referenced object "${payload.field.relationObject}" does not exist`)
          }
        }
      }
    }

    // Validate relation modifications
    if (payload.relation) {
      const targetObject = this.schemaRegistry.getObject(payload.relation.targetObject)
      if (!targetObject) {
        errors.push(`Referenced object "${payload.relation.targetObject}" does not exist`)
      }
    }
  }

  /**
   * Validate permission scope patch
   */
  private validatePermissionPatch(
    patch: Patch,
    errors: string[],
    warnings: string[],
    actorPermissions?: string[]
  ): void {
    const payload = patch.payload as any

    // Permission escalation prevention
    if (actorPermissions && payload.allow) {
      const unauthorizedPermissions = payload.allow.filter(
        (perm: string) => !actorPermissions.includes(perm)
      )
      if (unauthorizedPermissions.length > 0) {
        errors.push(
          `Cannot grant permissions exceeding actor's permissions: ${unauthorizedPermissions.join(', ')}`
        )
      }
    }

    // Validate permission structure
    if (payload.permissions) {
      const validActions = ['view', 'create', 'edit', 'delete']
      const actions = Object.keys(payload.permissions)
      for (const action of actions) {
        if (!validActions.includes(action)) {
          errors.push(`Invalid permission action: ${action}`)
        }
      }
    }
  }

  /**
   * Validate state scope patch
   */
  private validateStatePatch(
    patch: Patch,
    errors: string[],
    _warnings: string[]
  ): void {
    const payload = patch.payload as any

    // Check if object exists (states belong to objects)
    if (patch.target.type === 'object') {
      const objectSchema = this.schemaRegistry.getObject(patch.target.identifier)
      if (!objectSchema) {
        errors.push(`Object "${patch.target.identifier}" does not exist`)
      }
    }

    // Validate state structure
    if (payload.state) {
      if (!payload.state.name) {
        errors.push('State must have a name')
      }

      if (payload.state.transitions && !Array.isArray(payload.state.transitions)) {
        errors.push('State transitions must be an array')
      }
    }

    // Validate transition structure
    if (payload.transition) {
      if (!payload.transition.from || !payload.transition.to) {
        errors.push('Transition must have "from" and "to" states')
      }
    }
  }

  /**
   * Validate menu scope patch
   */
  private validateMenuPatch(
    patch: Patch,
    errors: string[],
    warnings: string[]
  ): void {
    const payload = patch.payload as any

    // Validate menu item structure
    if (payload.item) {
      if (!payload.item.label || !payload.item.path) {
        errors.push('Menu item must have label and path')
      }

      // Validate path format
      if (payload.item.path && !payload.item.path.startsWith('/')) {
        warnings.push('Menu path should start with "/"')
      }
    }
  }

  /**
   * Assign security level based on patch operation and scope
   */
  private assignSecurityLevel(patch: Patch, _errors: string[]): SecurityLevel {
    // L3: Dangerous operations that should be blocked
    if (
      patch.scope === 'permission' &&
      (patch.operation === 'update' || patch.operation === 'remove')
    ) {
      return 'L3'
    }

    if (
      patch.scope === 'object' &&
      patch.operation === 'remove' &&
      patch.target.type === 'field'
    ) {
      return 'L3'
    }

    // L2: Operations requiring confirmation
    if (
      patch.scope === 'permission' &&
      patch.operation === 'add'
    ) {
      return 'L2'
    }

    if (
      patch.scope === 'object' &&
      patch.operation === 'update' &&
      patch.target.type === 'field'
    ) {
      return 'L2'
    }

    if (
      patch.scope === 'state' &&
      (patch.operation === 'update' || patch.operation === 'remove')
    ) {
      return 'L2'
    }

    // L1: Safe operations that can be auto-executed
    if (
      patch.scope === 'page' &&
      patch.operation === 'add' &&
      patch.target.type === 'field'
    ) {
      return 'L1'
    }

    if (
      patch.scope === 'object' &&
      patch.operation === 'add' &&
      patch.target.type === 'field'
    ) {
      return 'L1'
    }

    if (
      patch.scope === 'menu' &&
      patch.operation === 'add'
    ) {
      return 'L1'
    }

    // Default to L2 for unknown combinations
    return 'L2'
  }

  /**
   * Check if string is valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * Check if string is valid ISO-8601 timestamp
   */
  private isValidISO8601(str: string): boolean {
    try {
      const date = new Date(str)
      return date.toISOString() === str || !isNaN(date.getTime())
    } catch {
      return false
    }
  }
}
