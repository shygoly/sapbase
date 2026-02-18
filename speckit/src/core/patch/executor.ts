// Patch executor - applies patches to schemas without code generation
import type {
  Patch,
  PatchExecutionResult,
  PatchPayload,
  PagePatchPayload,
  ObjectPatchPayload,
  PermissionPatchPayload,
  StatePatchPayload,
  MenuPatchPayload,
} from './types'
import type {
  ObjectSchema,
  ViewSchema,
  PageSchema,
  FieldDefinition,
} from '../schema/types'
import { SchemaRegistry } from '../schema/registry'

/**
 * Patch executor that applies patches to schemas
 * NEVER generates code files - only modifies schema JSON structures
 */
export class PatchExecutor {
  private schemaRegistry: SchemaRegistry
  private dryRunMode: boolean = false

  constructor(schemaRegistry: SchemaRegistry, dryRunMode: boolean = false) {
    this.schemaRegistry = schemaRegistry
    this.dryRunMode = dryRunMode
  }

  /**
   * Execute a patch and return result
   */
  async execute(
    patch: Patch,
    currentSchema?: ObjectSchema | ViewSchema | PageSchema
  ): Promise<PatchExecutionResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let updatedSchema: any = null

    try {
      // Load current schema if not provided
      if (!currentSchema) {
        currentSchema = this.loadSchema(patch)
        if (!currentSchema) {
          return {
            success: false,
            patchId: patch.patchId,
            errors: [`Schema not found for target: ${patch.target.identifier}`],
          }
        }
      }

      // Create a deep copy for modification
      const schemaCopy = JSON.parse(JSON.stringify(currentSchema))

      // Apply patch based on scope
      switch (patch.scope) {
        case 'page':
          updatedSchema = this.applyPagePatch(
            patch,
            schemaCopy as PageSchema,
            errors,
            warnings
          )
          break
        case 'object':
          updatedSchema = this.applyObjectPatch(
            patch,
            schemaCopy as ObjectSchema,
            errors,
            warnings
          )
          break
        case 'permission':
          updatedSchema = this.applyPermissionPatch(
            patch,
            schemaCopy as ObjectSchema | ViewSchema | PageSchema,
            errors,
            warnings
          )
          break
        case 'state':
          updatedSchema = this.applyStatePatch(
            patch,
            schemaCopy as ObjectSchema,
            errors,
            warnings
          )
          break
        case 'menu':
          // Menu patches don't modify schemas directly
          warnings.push('Menu patches are handled separately')
          updatedSchema = schemaCopy
          break
        default:
          errors.push(`Unknown patch scope: ${patch.scope}`)
          return {
            success: false,
            patchId: patch.patchId,
            errors,
          }
      }

      if (errors.length > 0) {
        return {
          success: false,
          patchId: patch.patchId,
          errors,
          warnings,
        }
      }

      // Update timestamp
      if (updatedSchema) {
        updatedSchema.updatedAt = new Date().toISOString()
        if (updatedSchema.version) {
          // Increment version if it's a number, otherwise keep as string
          const currentVersion = parseInt(updatedSchema.version, 10)
          if (!isNaN(currentVersion)) {
            updatedSchema.version = String(currentVersion + 1)
          }
        }
      }

      return {
        success: true,
        patchId: patch.patchId,
        warnings,
        changes: {
          before: currentSchema,
          after: updatedSchema,
        },
      }
    } catch (error) {
      return {
        success: false,
        patchId: patch.patchId,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings,
      }
    }
  }

  /**
   * Apply page scope patch
   */
  private applyPagePatch(
    patch: Patch,
    schema: PageSchema,
    errors: string[],
    warnings: string[]
  ): PageSchema {
    const payload = patch.payload as PagePatchPayload

    switch (patch.operation) {
      case 'add':
        if (payload.field) {
          // Add field to view schema (need to resolve view first)
          warnings.push('Page field additions require view schema modification')
        }
        if (payload.action) {
          // Add action to view schema
          warnings.push('Page action additions require view schema modification')
        }
        if (payload.metadata) {
          schema.metadata = {
            ...schema.metadata,
            ...payload.metadata,
          }
        }
        break

      case 'update':
        if (payload.metadata) {
          schema.metadata = {
            ...schema.metadata,
            ...payload.metadata,
          }
        }
        break

      case 'remove':
        if (payload.field) {
          warnings.push('Page field removal requires view schema modification')
        }
        break

      case 'replace':
        if (payload.metadata) {
          schema.metadata = payload.metadata
        }
        break

      default:
        errors.push(`Unsupported operation for page scope: ${patch.operation}`)
    }

    return schema
  }

  /**
   * Apply object scope patch
   */
  private applyObjectPatch(
    patch: Patch,
    schema: ObjectSchema,
    errors: string[],
    warnings: string[]
  ): ObjectSchema {
    const payload = patch.payload as ObjectPatchPayload

    switch (patch.operation) {
      case 'add':
        if (payload.field) {
          // Check if field already exists
          const existingField = schema.fields.find(
            (f) => f.name === payload.field!.name
          )
          if (existingField) {
            errors.push(`Field "${payload.field.name}" already exists`)
            return schema
          }

          // Add new field
          const newField: FieldDefinition = {
            name: payload.field.name,
            label: payload.field.label || payload.field.name,
            type: payload.field.type as any,
            required: payload.field.required,
            readonly: payload.field.readonly,
            hidden: payload.field.hidden,
            default: payload.field.default,
            placeholder: payload.field.placeholder,
            description: payload.field.description,
            validation: payload.field.validation,
            options: payload.field.options,
          }

          schema.fields.push(newField)
        }

        if (payload.relation) {
          if (!schema.relations) {
            schema.relations = []
          }
          schema.relations.push({
            name: payload.relation.name,
            type: payload.relation.type,
            targetObject: payload.relation.targetObject,
            foreignKey: payload.relation.foreignKey,
          })
        }

        if (payload.state) {
          if (!schema.stateMachine) {
            schema.stateMachine = JSON.stringify({
              states: [payload.state],
            })
          } else {
            warnings.push('State machine modifications require manual update')
          }
        }
        break

      case 'update':
        if (payload.field) {
          const fieldIndex = schema.fields.findIndex(
            (f) => f.name === payload.field!.name
          )
          if (fieldIndex === -1) {
            errors.push(`Field "${payload.field.name}" not found`)
            return schema
          }

          // Update field properties
          schema.fields[fieldIndex] = {
            ...schema.fields[fieldIndex],
            ...payload.field,
            name: schema.fields[fieldIndex].name, // Preserve name
          }
        }
        break

      case 'remove':
        if (payload.field) {
          const fieldIndex = schema.fields.findIndex(
            (f) => f.name === payload.field!.name
          )
          if (fieldIndex === -1) {
            errors.push(`Field "${payload.field.name}" not found`)
            return schema
          }

          schema.fields.splice(fieldIndex, 1)
        }

        if (payload.relation && schema.relations) {
          const relationIndex = schema.relations.findIndex(
            (r) => r.name === payload.relation!.name
          )
          if (relationIndex !== -1) {
            schema.relations.splice(relationIndex, 1)
          }
        }
        break

      case 'reorder':
        if (payload.field && patch.target.path) {
          // Reorder fields based on path or payload order
          warnings.push('Field reordering requires explicit order array')
        }
        break

      case 'replace':
        if (payload.field) {
          const fieldIndex = schema.fields.findIndex(
            (f) => f.name === payload.field!.name
          )
          if (fieldIndex === -1) {
            errors.push(`Field "${payload.field.name}" not found`)
            return schema
          }

          schema.fields[fieldIndex] = payload.field as FieldDefinition
        }
        break

      default:
        errors.push(`Unsupported operation for object scope: ${patch.operation}`)
    }

    return schema
  }

  /**
   * Apply permission scope patch
   */
  private applyPermissionPatch(
    patch: Patch,
    schema: ObjectSchema | ViewSchema | PageSchema,
    errors: string[],
    warnings: string[]
  ): ObjectSchema | ViewSchema | PageSchema {
    const payload = patch.payload as PermissionPatchPayload

    if (!schema.permissions) {
      schema.permissions = {}
    }

    switch (patch.operation) {
      case 'add':
      case 'update':
        if (payload.permissions) {
          schema.permissions = {
            ...schema.permissions,
            ...payload.permissions,
          }
        }
        break

      case 'remove':
        if (payload.permissions) {
          const permKeys = Object.keys(payload.permissions)
          for (const key of permKeys) {
            delete (schema.permissions as any)[key]
          }
        }
        break

      case 'replace':
        if (payload.permissions) {
          schema.permissions = payload.permissions as any
        }
        break

      default:
        errors.push(
          `Unsupported operation for permission scope: ${patch.operation}`
        )
    }

    return schema
  }

  /**
   * Apply state scope patch
   */
  private applyStatePatch(
    patch: Patch,
    schema: ObjectSchema,
    errors: string[],
    warnings: string[]
  ): ObjectSchema {
    const payload = patch.payload as StatePatchPayload

    if (!schema.stateMachine) {
      schema.stateMachine = JSON.stringify({ states: [] })
    }

    try {
      const stateMachine = JSON.parse(schema.stateMachine)

      switch (patch.operation) {
        case 'add':
          if (payload.state) {
            if (!stateMachine.states) {
              stateMachine.states = []
            }
            stateMachine.states.push(payload.state)
          }
          break

        case 'update':
          if (payload.state) {
            const stateIndex = stateMachine.states?.findIndex(
              (s: any) => s.name === payload.state!.name
            )
            if (stateIndex !== undefined && stateIndex !== -1) {
              stateMachine.states[stateIndex] = {
                ...stateMachine.states[stateIndex],
                ...payload.state,
              }
            }
          }
          break

        case 'remove':
          if (payload.state) {
            if (stateMachine.states) {
              stateMachine.states = stateMachine.states.filter(
                (s: any) => s.name !== payload.state!.name
              )
            }
          }
          break

        default:
          errors.push(`Unsupported operation for state scope: ${patch.operation}`)
      }

      schema.stateMachine = JSON.stringify(stateMachine)
    } catch (error) {
      errors.push(`Invalid state machine format: ${error}`)
    }

    return schema
  }

  /**
   * Load schema based on patch target
   */
  private loadSchema(
    patch: Patch
  ): ObjectSchema | ViewSchema | PageSchema | null {
    switch (patch.scope) {
      case 'object':
        return this.schemaRegistry.getObject(patch.target.identifier)
      case 'page':
        return this.schemaRegistry.getPage(patch.target.identifier)
      case 'permission':
        // Permissions are part of object/view/page schemas
        return (
          this.schemaRegistry.getObject(patch.target.identifier) ||
          this.schemaRegistry.getView(patch.target.identifier) ||
          this.schemaRegistry.getPage(patch.target.identifier)
        )
      case 'state':
        return this.schemaRegistry.getObject(patch.target.identifier)
      default:
        return null
    }
  }

  /**
   * Set dry-run mode
   */
  setDryRunMode(enabled: boolean): void {
    this.dryRunMode = enabled
  }
}
