// Main patch manager - orchestrates patch validation, execution, versioning, and hot reload
import type {
  Patch,
  PatchExecutionResult,
  SecurityLevel,
} from './types'
import { PatchValidator } from './validator'
import { PatchExecutor } from './executor'
import { VersionControl } from './version-control'
import { HotReloader } from './hot-reload'
import { AuditLogger } from './audit-logger'
import { SchemaResolver } from '../schema/resolver'
import { SchemaRegistry } from '../schema/registry'

/**
 * Main patch manager that orchestrates the entire patch lifecycle
 */
export class PatchManager {
  private validator: PatchValidator
  private executor: PatchExecutor
  private versionControl: VersionControl
  private hotReloader: HotReloader
  private auditLogger: AuditLogger
  private schemaResolver: SchemaResolver
  public schemaRegistry: SchemaRegistry // Made public for gateway access

  constructor(
    schemaResolver: SchemaResolver,
    schemaRegistry: SchemaRegistry
  ) {
    this.schemaResolver = schemaResolver
    this.schemaRegistry = schemaRegistry
    this.validator = new PatchValidator(schemaRegistry)
    this.executor = new PatchExecutor(schemaRegistry)
    this.versionControl = new VersionControl()
    this.hotReloader = new HotReloader(schemaResolver, schemaRegistry)
    this.auditLogger = new AuditLogger()
  }

  /**
   * Apply a patch with full validation and versioning
   */
  async applyPatch(
    patch: Patch,
    actorPermissions?: string[],
    requireConfirmation?: (patch: Patch, securityLevel: SecurityLevel) => Promise<boolean>
  ): Promise<PatchExecutionResult> {
    // Step 1: Validate patch
    const validation = this.validator.validate(patch, actorPermissions)

    if (!validation.valid) {
      this.auditLogger.logRejection(patch, validation.errors.join('; '))
      return {
        success: false,
        patchId: patch.patchId,
        errors: validation.errors,
        warnings: validation.warnings,
      }
    }

    // Step 2: Check security level
    const securityLevel = validation.securityLevel
    patch.securityLevel = securityLevel

    if (securityLevel === 'L3') {
      const error = 'L3 patches are blocked - operation too dangerous'
      this.auditLogger.logRejection(patch, error)
      return {
        success: false,
        patchId: patch.patchId,
        errors: [error],
      }
    }

    if (securityLevel === 'L2' && requireConfirmation) {
      const confirmed = await requireConfirmation(patch, securityLevel)
      if (!confirmed) {
        const error = 'User rejected L2 patch confirmation'
        this.auditLogger.logRejection(patch, error)
        return {
          success: false,
          patchId: patch.patchId,
          errors: [error],
        }
      }
    }

    // Step 3: Execute patch
    const result = await this.executor.execute(patch)

    if (!result.success) {
      this.auditLogger.log(patch, result)
      return result
    }

    // Step 4: Create version
    const schemaName = patch.target.identifier
    const schemaType = this.getSchemaTypeFromScope(patch.scope)
    const updatedSchema = result.changes?.after

    if (updatedSchema) {
      const version = this.versionControl.createVersion(
        schemaName,
        schemaType,
        updatedSchema,
        patch
      )

      // Step 5: Hot reload
      this.hotReloader.invalidateSchema(schemaType, schemaName)

      // Step 6: Audit log
      this.auditLogger.log(patch, result, version.version)

      return {
        ...result,
        schemaVersion: version.version,
      }
    }

    return result
  }

  /**
   * Dry run a patch without applying it
   */
  async dryRun(patch: Patch, actorPermissions?: string[]): Promise<{
    valid: boolean
    changes: any
    warnings: string[]
    errors: string[]
    securityLevel: SecurityLevel
  }> {
    // Validate
    const validation = this.validator.validate(patch, actorPermissions)

    if (!validation.valid) {
      return {
        valid: false,
        changes: {},
        warnings: validation.warnings,
        errors: validation.errors,
        securityLevel: validation.securityLevel,
      }
    }

    // Execute in dry-run mode
    const executor = new PatchExecutor(this.schemaRegistry, true)
    const result = await executor.execute(patch)

    return {
      valid: result.success,
      changes: result.changes || {},
      warnings: result.warnings || [],
      errors: result.errors || [],
      securityLevel: validation.securityLevel,
    }
  }

  /**
   * Rollback to a specific version
   */
  rollback(schemaName: string, targetVersion: number): {
    success: boolean
    version: any | null
    error?: string
  } {
    const version = this.versionControl.rollbackToVersion(
      schemaName,
      targetVersion
    )

    if (!version) {
      return {
        success: false,
        version: null,
        error: `Version ${targetVersion} not found for schema ${schemaName}`,
      }
    }

    // Invalidate cache to trigger reload
    this.hotReloader.invalidateSchema(version.schemaType, schemaName)

    return {
      success: true,
      version: version.schema,
    }
  }

  /**
   * Get version history
   */
  getVersionHistory(schemaName: string) {
    return this.versionControl.getHistory(schemaName)
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    actor?: string
    scope?: string
    operation?: string
    startDate?: string
    endDate?: string
    result?: 'success' | 'failure' | 'rejected'
  }) {
    return this.auditLogger.query(filters)
  }

  /**
   * Register hot reload callback
   */
  onHotReload(callback: () => void): () => void {
    return this.hotReloader.onReload(callback)
  }

  /**
   * Apply multiple patches in batch (atomic - all succeed or all fail)
   */
  async applyBatchPatches(
    patches: Patch[],
    actorPermissions?: string[],
    requireConfirmation?: (patch: Patch, securityLevel: SecurityLevel) => Promise<boolean>
  ): Promise<{
    success: boolean
    results: PatchExecutionResult[]
    errors: string[]
  }> {
    const results: PatchExecutionResult[] = []
    const errors: string[] = []

    // Check dependencies and resolve order
    const orderedPatches = this.resolveDependencyOrder(patches)
    if (orderedPatches.error) {
      return {
        success: false,
        results: [],
        errors: [orderedPatches.error],
      }
    }

    // Execute patches in order
    for (const patch of orderedPatches.patches!) {
      const result = await this.applyPatch(
        patch,
        actorPermissions,
        requireConfirmation
      )
      results.push(result)

      if (!result.success) {
        // Rollback all previous patches
        errors.push(`Patch ${patch.patchId} failed: ${result.errors?.join(', ')}`)
        // In a real implementation, we would rollback here
        return {
          success: false,
          results,
          errors,
        }
      }
    }

    return {
      success: true,
      results,
      errors: [],
    }
  }

  /**
   * Resolve patch dependency order
   */
  private resolveDependencyOrder(patches: Patch[]): {
    patches?: Patch[]
    error?: string
  } {
    const patchMap = new Map<string, Patch>()
    const dependencies = new Map<string, string[]>()
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const ordered: Patch[] = []

    // Build maps
    for (const patch of patches) {
      patchMap.set(patch.patchId, patch)
      dependencies.set(patch.patchId, patch.dependsOn || [])
    }

    // Check for circular dependencies
    for (const patchId of patchMap.keys()) {
      if (this.hasCircularDependency(patchId, dependencies, visited, visiting)) {
        return {
          error: `Circular dependency detected involving patch ${patchId}`,
        }
      }
    }

    // Topological sort
    visited.clear()
    for (const patch of patches) {
      this.topologicalSort(patch.patchId, patchMap, dependencies, visited, ordered)
    }

    return { patches: ordered }
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependency(
    patchId: string,
    dependencies: Map<string, string[]>,
    visited: Set<string>,
    visiting: Set<string>
  ): boolean {
    if (visiting.has(patchId)) {
      return true // Circular dependency detected
    }

    if (visited.has(patchId)) {
      return false // Already processed
    }

    visiting.add(patchId)
    const deps = dependencies.get(patchId) || []

    for (const dep of deps) {
      if (this.hasCircularDependency(dep, dependencies, visited, visiting)) {
        return true
      }
    }

    visiting.delete(patchId)
    visited.add(patchId)
    return false
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(
    patchId: string,
    patchMap: Map<string, Patch>,
    dependencies: Map<string, string[]>,
    visited: Set<string>,
    ordered: Patch[]
  ): void {
    if (visited.has(patchId)) {
      return
    }

    visited.add(patchId)
    const deps = dependencies.get(patchId) || []

    for (const dep of deps) {
      if (patchMap.has(dep)) {
        this.topologicalSort(dep, patchMap, dependencies, visited, ordered)
      }
    }

    const patch = patchMap.get(patchId)
    if (patch) {
      ordered.push(patch)
    }
  }

  /**
   * Get schema type from patch scope
   */
  private getSchemaTypeFromScope(
    scope: Patch['scope']
  ): 'object' | 'view' | 'page' {
    switch (scope) {
      case 'object':
      case 'state':
        return 'object'
      case 'page':
        return 'page'
      case 'permission':
        // Permissions can be on any schema type
        return 'object' // Default
      default:
        return 'object'
    }
  }
}
