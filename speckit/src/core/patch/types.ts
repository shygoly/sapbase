// Patch DSL type definitions for Speckit ERP Frontend Runtime
// This module defines the structure and types for declarative schema modifications

/**
 * Patch scope - defines what part of the system the patch modifies.
 * Five patch types: page (page structure), object (form structure), permission (permission rules),
 * state (state machine), menu (menu/navigation). Layout changes use scope "page".
 */
export type PatchScope = 'page' | 'object' | 'permission' | 'state' | 'menu'

/**
 * Patch operation - defines the type of modification
 */
export type PatchOperation = 'add' | 'update' | 'remove' | 'reorder' | 'replace'

/**
 * Security level - determines if patch can be auto-executed
 */
export type SecurityLevel = 'L1' | 'L2' | 'L3'

/**
 * Patch target - identifies what to modify
 */
export interface PatchTarget {
  type: 'page' | 'object' | 'field' | 'action' | 'state' | 'role' | 'menu' | 'permission'
  identifier: string // Name/ID of the target (e.g., "UserList", "User", "sales")
  path?: string // Optional nested path (e.g., "fields.email" for nested modifications)
}

/**
 * Page scope payload - for modifying page structure
 */
export interface PagePatchPayload {
  field?: {
    name: string
    label: string
    component?: string
    sortable?: boolean
    filterable?: boolean
    width?: number
    align?: 'left' | 'center' | 'right'
  }
  action?: {
    name: string
    label: string
    type: 'primary' | 'secondary' | 'danger'
    permissions?: string[]
  }
  metadata?: {
    title?: string
    description?: string
    icon?: string
  }
}

/**
 * Object scope payload - for modifying object schemas (forms, fields)
 */
export interface ObjectPatchPayload {
  field?: {
    name: string
    label: string
    type: string
    required?: boolean
    readonly?: boolean
    hidden?: boolean
    default?: any
    placeholder?: string
    description?: string
    validation?: Array<{
      type: string
      value?: any
      message?: string
    }>
    options?: Array<{ label: string; value: any }>
    component?: string
  }
  relation?: {
    name: string
    type: 'one-to-one' | 'one-to-many' | 'many-to-many'
    targetObject: string
    foreignKey?: string
  }
  state?: {
    name: string
    transitions?: string[]
  }
}

/**
 * Permission scope payload - for modifying permissions
 */
export interface PermissionPatchPayload {
  allow?: string[] // Actions to allow
  deny?: string[] // Actions to deny
  roles?: string[] // Roles affected
  permissions?: {
    view?: string[]
    create?: string[]
    edit?: string[]
    delete?: string[]
  }
}

/**
 * State scope payload - for modifying state machines
 */
export interface StatePatchPayload {
  state?: {
    name: string
    transitions?: string[]
    initial?: boolean
  }
  transition?: {
    from: string
    to: string
    conditions?: string[]
  }
}

/**
 * Menu scope payload - for modifying navigation/menu
 */
export interface MenuPatchPayload {
  item?: {
    label: string
    path: string
    icon?: string
    order?: number
    permissions?: string[]
    children?: Array<{
      label: string
      path: string
      icon?: string
    }>
  }
}

/**
 * Union type for all patch payloads
 */
export type PatchPayload =
  | PagePatchPayload
  | ObjectPatchPayload
  | PermissionPatchPayload
  | StatePatchPayload
  | MenuPatchPayload

/**
 * Main Patch interface - the core Patch DSL document structure
 */
export interface Patch {
  /** Patch DSL version */
  version: string // "1.0"
  /** Unique identifier for this patch (UUID) */
  patchId: string
  /** ISO-8601 timestamp when patch was created */
  timestamp: string
  /** Who generated this patch */
  actor: 'ai' | 'human'
  /** What part of the system this patch modifies */
  scope: PatchScope
  /** Type of modification */
  operation: PatchOperation
  /** What to modify */
  target: PatchTarget
  /** Modification details */
  payload: PatchPayload
  /** Security level (auto-assigned by validator) */
  securityLevel?: SecurityLevel
  /** Optional: Dependencies on other patches */
  dependsOn?: string[] // Array of patch IDs
  /** Optional: Description of what this patch does */
  description?: string
}

/**
 * Patch validation result
 */
export interface PatchValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  securityLevel: SecurityLevel
}

/**
 * Patch execution result
 */
export interface PatchExecutionResult {
  success: boolean
  patchId: string
  schemaVersion?: number
  errors?: string[]
  warnings?: string[]
  changes?: {
    before: any
    after: any
  }
}

/**
 * Schema version metadata
 */
export interface SchemaVersion {
  /** Incremental version number */
  version: number
  /** Reference to previous version */
  previousVersion: number | null
  /** UUID of applied patch */
  patchId: string
  /** ISO-8601 timestamp */
  timestamp: string
  /** Who applied the patch */
  actor: string
  /** Schema name/identifier */
  schemaName: string
  /** Schema type */
  schemaType: 'object' | 'view' | 'page'
  /** The schema content */
  schema: any
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  patchId: string
  timestamp: string
  actor: string
  scope: PatchScope
  operation: PatchOperation
  target: PatchTarget
  result: 'success' | 'failure' | 'rejected'
  errors?: string[]
  schemaVersion?: number
}

/**
 * Patch generation request (for AI Gateway)
 */
export interface PatchGenerationRequest {
  /** Natural language description of desired change */
  intent: string
  context: {
    /** Current schema snapshot */
    currentSchema?: any
    /** Constraints or requirements */
    constraints?: string[]
    /** Target schema name */
    targetSchema?: string
  }
}

/**
 * Patch generation response (for AI Gateway)
 */
export interface PatchGenerationResponse {
  /** Generated patch */
  patch: Patch
  /** Explanation of what the patch does */
  explanation: string
  /** Assigned security level */
  securityLevel: SecurityLevel
  /** Optional dry-run result */
  dryRunResult?: {
    valid: boolean
    changes: any
    warnings: string[]
  }
}

/**
 * Dry run result
 */
export interface DryRunResult {
  valid: boolean
  changes: {
    before: any
    after: any
  }
  warnings: string[]
  errors: string[]
  securityLevel: SecurityLevel
}
