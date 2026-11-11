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
  /** 单位标识（kg/m3/pcs…）；只影响展示，不静默换算。 */
  unit?: string
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


// UI component/interaction metadata (additive; unknown values must fall back)
export type UiComponentKey =
  | 'default-list'
  | 'default-form'
  | 'default-detail'
  | 'workbench'
  | 'dashboard'
  | 'timeline'

export interface UiInteraction {
  pagination?: 'client' | 'server' | 'none'
  confirm?: 'none' | 'dirty' | 'destructive'
  draft?: { enabled?: boolean; maxBytes?: number }
  virtualization?: { threshold?: number }
}

export interface UiMetadata {
  /** 白名单组件键；未知值按页面类型回退默认组件，禁止远端脚本/动态 import。 */
  componentKey?: UiComponentKey | string
  interaction?: UiInteraction
}

// Page metadata
export interface PageMetadata extends UiMetadata {
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
export interface PageSchema extends UiMetadata {
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
export interface ResolvedPageSchema extends UiMetadata {
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
