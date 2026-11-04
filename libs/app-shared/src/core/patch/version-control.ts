// Version control system for schema patches
import type { SchemaVersion, Patch } from './types'
import type { ObjectSchema, ViewSchema, PageSchema } from '../schema/types'

/**
 * Version control manager for schema patches
 */
export class VersionControl {
  private versions = new Map<string, SchemaVersion[]>() // schemaName -> versions[]

  /**
   * Create a new schema version from a patch
   */
  createVersion(
    schemaName: string,
    schemaType: 'object' | 'view' | 'page',
    schema: ObjectSchema | ViewSchema | PageSchema,
    patch: Patch
  ): SchemaVersion {
    const existingVersions = this.versions.get(schemaName) || []
    const previousVersion =
      existingVersions.length > 0
        ? existingVersions[existingVersions.length - 1].version
        : null

    const newVersion: SchemaVersion = {
      version: previousVersion ? previousVersion + 1 : 1,
      previousVersion,
      patchId: patch.patchId,
      timestamp: patch.timestamp,
      actor: patch.actor,
      schemaName,
      schemaType,
      schema: JSON.parse(JSON.stringify(schema)), // Deep copy
    }

    // Store version
    if (!this.versions.has(schemaName)) {
      this.versions.set(schemaName, [])
    }
    this.versions.get(schemaName)!.push(newVersion)

    return newVersion
  }

  /**
   * Get version history for a schema
   */
  getHistory(schemaName: string): SchemaVersion[] {
    return this.versions.get(schemaName) || []
  }

  /**
   * Get a specific version
   */
  getVersion(schemaName: string, version: number): SchemaVersion | null {
    const versions = this.versions.get(schemaName) || []
    return versions.find((v) => v.version === version) || null
  }

  /**
   * Get latest version
   */
  getLatestVersion(schemaName: string): SchemaVersion | null {
    const versions = this.versions.get(schemaName) || []
    return versions.length > 0 ? versions[versions.length - 1] : null
  }

  /**
   * Rollback to a specific version
   */
  rollbackToVersion(
    schemaName: string,
    targetVersion: number
  ): SchemaVersion | null {
    const target = this.getVersion(schemaName, targetVersion)
    if (!target) {
      return null
    }

    // Remove all versions after target
    const versions = this.versions.get(schemaName) || []
    const targetIndex = versions.findIndex((v) => v.version === targetVersion)
    if (targetIndex !== -1) {
      versions.splice(targetIndex + 1)
      this.versions.set(schemaName, versions)
    }

    return target
  }

  /**
   * Compare two versions
   */
  compareVersions(
    schemaName: string,
    version1: number,
    version2: number
  ): {
    added: any[]
    removed: any[]
    modified: any[]
  } {
    const v1 = this.getVersion(schemaName, version1)
    const v2 = this.getVersion(schemaName, version2)

    if (!v1 || !v2) {
      return { added: [], removed: [], modified: [] }
    }

    // Simple diff for schema objects
    const diff = {
      added: [] as any[],
      removed: [] as any[],
      modified: [] as any[],
    }

    // Compare fields if both are object schemas
    if (v1.schemaType === 'object' && v2.schemaType === 'object') {
      const schema1 = v1.schema as ObjectSchema
      const schema2 = v2.schema as ObjectSchema

      const fields1 = new Map(schema1.fields.map((f) => [f.name, f]))
      const fields2 = new Map(schema2.fields.map((f) => [f.name, f]))

      // Find added fields
      for (const [name, field] of fields2) {
        if (!fields1.has(name)) {
          diff.added.push({ type: 'field', name, field })
        }
      }

      // Find removed fields
      for (const [name, field] of fields1) {
        if (!fields2.has(name)) {
          diff.removed.push({ type: 'field', name, field })
        }
      }

      // Find modified fields
      for (const [name, field1] of fields1) {
        const field2 = fields2.get(name)
        if (field2 && JSON.stringify(field1) !== JSON.stringify(field2)) {
          diff.modified.push({
            type: 'field',
            name,
            before: field1,
            after: field2,
          })
        }
      }
    }

    return diff
  }

  /**
   * Get all versions (for audit)
   */
  getAllVersions(): Map<string, SchemaVersion[]> {
    return new Map(this.versions)
  }

  /**
   * Clear version history (use with caution)
   */
  clearHistory(schemaName?: string): void {
    if (schemaName) {
      this.versions.delete(schemaName)
    } else {
      this.versions.clear()
    }
  }
}
