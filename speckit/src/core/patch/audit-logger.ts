// Audit logging system for patch operations
import type { AuditLogEntry, Patch, PatchExecutionResult } from './types'

/**
 * Audit logger for tracking all patch operations
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = []
  private maxLogs: number = 10000 // Limit in-memory logs

  /**
   * Log a patch operation
   */
  log(
    patch: Patch,
    result: PatchExecutionResult,
    schemaVersion?: number
  ): void {
    const entry: AuditLogEntry = {
      id: this.generateLogId(),
      patchId: patch.patchId,
      timestamp: new Date().toISOString(),
      actor: patch.actor,
      scope: patch.scope,
      operation: patch.operation,
      target: patch.target,
      result: result.success ? 'success' : 'failure',
      errors: result.errors,
      schemaVersion,
    }

    this.logs.push(entry)

    // Trim logs if exceeding limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // In a real implementation, this would also persist to storage
    // For now, we keep it in memory
  }

  /**
   * Log a rejected patch
   */
  logRejection(patch: Patch, reason: string): void {
    const entry: AuditLogEntry = {
      id: this.generateLogId(),
      patchId: patch.patchId,
      timestamp: new Date().toISOString(),
      actor: patch.actor,
      scope: patch.scope,
      operation: patch.operation,
      target: patch.target,
      result: 'rejected',
      errors: [reason],
    }

    this.logs.push(entry)
  }

  /**
   * Query audit logs
   */
  query(filters?: {
    actor?: string
    scope?: string
    operation?: string
    startDate?: string
    endDate?: string
    result?: 'success' | 'failure' | 'rejected'
  }): AuditLogEntry[] {
    let results = [...this.logs]

    if (filters) {
      if (filters.actor) {
        results = results.filter((log) => log.actor === filters.actor)
      }

      if (filters.scope) {
        results = results.filter((log) => log.scope === filters.scope)
      }

      if (filters.operation) {
        results = results.filter((log) => log.operation === filters.operation)
      }

      if (filters.result) {
        results = results.filter((log) => log.result === filters.result)
      }

      if (filters.startDate) {
        results = results.filter(
          (log) => log.timestamp >= filters.startDate!
        )
      }

      if (filters.endDate) {
        results = results.filter((log) => log.timestamp <= filters.endDate!)
      }
    }

    // Sort by timestamp descending (newest first)
    return results.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  /**
   * Get log by ID
   */
  getLog(logId: string): AuditLogEntry | null {
    return this.logs.find((log) => log.id === logId) || null
  }

  /**
   * Get logs for a specific patch
   */
  getLogsForPatch(patchId: string): AuditLogEntry[] {
    return this.logs.filter((log) => log.patchId === patchId)
  }

  /**
   * Get all logs
   */
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs]
  }

  /**
   * Clear logs (use with caution)
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Export logs to JSON (for persistence)
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Import logs from JSON
   */
  importLogs(json: string): void {
    try {
      const imported = JSON.parse(json) as AuditLogEntry[]
      this.logs = [...this.logs, ...imported]
    } catch (error) {
      throw new Error(`Failed to import logs: ${error}`)
    }
  }
}
