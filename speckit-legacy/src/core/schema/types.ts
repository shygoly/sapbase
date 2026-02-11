// Schema system types for Speckit ERP Frontend Runtime

// Field types supported by the schema system
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'textarea'
  | 'relation'
  | 'file'

// Validation rule for a field
export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom'
  value?: any
  message?: string
}

// Field definition in Object Schema
export interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  required?: boolean
  readonly?: boolean
  hidden?: boolean
  default?: any
  placeholder?: string
  description?: string
  validation?: ValidationRule[]
  options?: Array<{ label: string; value: any }>
  relationObject?: string // For relation fields
  relationField?: string // For relation fields
  displayAs?: 'switch' | 'checkbox' | 'radio' // Display preference for certain field types
  permissions?: {
    view?: string[]
    edit?: string[]
  }
}

// Relation definition
export interface Relation {
  name: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  targetObject: string
  foreignKey?: string
}

// Object Schema - defines data structure
export interface ObjectSchema {
  name: string
  label: string
  description?: string
  fields: FieldDefinition[]
  relations?: Relation[]
  stateMachine?: string // Reference to state machine definition
  permissions?: {
    view?: string[]
    create?: string[]
    edit?: string[]
    delete?: string[]
  }
  version: string
  createdAt?: string
  updatedAt?: string
}

// Layout configuration for views
export interface LayoutConfig {
  type: 'grid' | 'flex' | 'stack'
  columns?: number
  gap?: number
  fields?: string[] // Field names to include
}

// Permission rule for views
export interface PermissionRule {
  field: string
  action: 'view' | 'edit' | 'delete'
  permissions: string[]
}

// View Schema - defines UI layout
export interface ViewSchema {
  name: string
  type: 'list' | 'form' | 'detail' | 'dashboard'
  object: string // Reference to ObjectSchema
  label?: string
  description?: string
  layout?: LayoutConfig
  permissions?: PermissionRule[]
  actions?: Array<{
    name: string
    label: string
    type: 'primary' | 'secondary' | 'danger'
    permissions?: string[]
  }>
  version: string
  createdAt?: string
  updatedAt?: string
}

// Page metadata
export interface PageMetadata {
  title: string
  description?: string
  icon?: string
  breadcrumb?: boolean
}

// Lifecycle hooks
export interface LifecycleHooks {
  onLoad?: string // Function name or URL
  onSave?: string
  onDelete?: string
  onStateChange?: string
}

// Page Schema - defines routing and metadata
export interface PageSchema {
  path: string
  view: string // Reference to ViewSchema
  label?: string
  metadata?: PageMetadata
  lifecycle?: LifecycleHooks
  permissions?: string[]
  version: string
  createdAt?: string
  updatedAt?: string
}

// Resolved page schema - fully resolved with all references
export interface ResolvedPageSchema {
  path: string
  type: 'list' | 'form' | 'detail' | 'dashboard'
  fields: FieldDefinition[]
  permissions: PermissionRule[]
  actions?: Array<{
    name: string
    label: string
    type: 'primary' | 'secondary' | 'danger'
    permissions?: string[]
  }>
  metadata?: PageMetadata
  lifecycle?: LifecycleHooks
}

// Schema registry entry
export interface SchemaRegistryEntry {
  type: 'object' | 'view' | 'page'
  name: string
  schema: ObjectSchema | ViewSchema | PageSchema
  loadedAt: number
}
