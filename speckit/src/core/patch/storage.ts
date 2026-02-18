// Patch storage and management utilities
import type { Patch, AuditLogEntry } from './types'

/**
 * Patch storage manager for file-based storage
 * Note: In Next.js, file writes must happen server-side via API routes
 * This module provides utilities for patch file management
 */
export class PatchStorage {
  private basePath: string

  constructor(basePath: string = '/patches') {
    this.basePath = basePath
  }

  /**
   * Generate patch file path
   */
  getPatchFilePath(patchId: string): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${this.basePath}/${year}/${month}/${day}/${patchId}.json`
  }

  /**
   * Generate audit log file path
   */
  getAuditLogFilePath(date?: Date): string {
    const logDate = date || new Date()
    const year = logDate.getFullYear()
    const month = String(logDate.getMonth() + 1).padStart(2, '0')
    const day = String(logDate.getDate()).padStart(2, '0')
    return `${this.basePath}/audit/${year}/${month}/${day}.json`
  }

  /**
   * Generate version file path
   */
  getVersionFilePath(schemaName: string, version: number): string {
    return `/specs/versions/${schemaName}/v${version}.json`
  }

  /**
   * Serialize patch to JSON
   */
  serializePatch(patch: Patch): string {
    return JSON.stringify(patch, null, 2)
  }

  /**
   * Deserialize patch from JSON
   */
  deserializePatch(json: string): Patch {
    return JSON.parse(json) as Patch
  }

  /**
   * Serialize audit log entry
   */
  serializeAuditLog(entry: AuditLogEntry): string {
    return JSON.stringify(entry, null, 2)
  }

  /**
   * Deserialize audit log entry
   */
  deserializeAuditLog(json: string): AuditLogEntry {
    return JSON.parse(json) as AuditLogEntry
  }

  /**
   * Generate patch metadata index entry
   */
  createPatchIndexEntry(patch: Patch): {
    patchId: string
    timestamp: string
    actor: string
    scope: string
    operation: string
    target: string
    securityLevel?: string
    filePath: string
  } {
    return {
      patchId: patch.patchId,
      timestamp: patch.timestamp,
      actor: patch.actor,
      scope: patch.scope,
      operation: patch.operation,
      target: patch.target.identifier,
      securityLevel: patch.securityLevel,
      filePath: this.getPatchFilePath(patch.patchId),
    }
  }
}

/**
 * Client-side patch storage (for browser)
 * Uses localStorage or IndexedDB for persistence
 */
export class ClientPatchStorage {
  private storageKey = 'speckit_patches'

  /**
   * Save patch to local storage
   */
  savePatch(patch: Patch): void {
    if (typeof window === 'undefined') return

    const patches = this.getAllPatches()
    patches.push(patch)
    localStorage.setItem(this.storageKey, JSON.stringify(patches))
  }

  /**
   * Get patch by ID
   */
  getPatch(patchId: string): Patch | null {
    if (typeof window === 'undefined') return null

    const patches = this.getAllPatches()
    return patches.find((p) => p.patchId === patchId) || null
  }

  /**
   * Get all patches
   */
  getAllPatches(): Patch[] {
    if (typeof window === 'undefined') return []

    const stored = localStorage.getItem(this.storageKey)
    return stored ? JSON.parse(stored) : []
  }

  /**
   * Query patches
   */
  queryPatches(filters?: {
    actor?: string
    scope?: string
    operation?: string
    startDate?: string
    endDate?: string
  }): Patch[] {
    let patches = this.getAllPatches()

    if (filters) {
      if (filters.actor) {
        patches = patches.filter((p) => p.actor === filters.actor)
      }

      if (filters.scope) {
        patches = patches.filter((p) => p.scope === filters.scope)
      }

      if (filters.operation) {
        patches = patches.filter((p) => p.operation === filters.operation)
      }

      if (filters.startDate) {
        patches = patches.filter((p) => p.timestamp >= filters.startDate!)
      }

      if (filters.endDate) {
        patches = patches.filter((p) => p.timestamp <= filters.endDate!)
      }
    }

    return patches.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  /**
   * Clear all patches
   */
  clearPatches(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.storageKey)
  }
}
