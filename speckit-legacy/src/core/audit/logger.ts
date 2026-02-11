'use client'

export interface AuditLogEntry {
  action: string
  resource: string
  resourceId?: string
  userId?: string
  changes?: Record<string, any>
  timestamp: Date
  status: 'success' | 'failure'
  error?: string
}

export class AuditLogger {
  private logs: AuditLogEntry[] = []

  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    this.logs.push({
      ...entry,
      timestamp: new Date(),
    })

    // Send to backend if needed
    this.sendToBackend(entry)
  }

  logCreate(resource: string, resourceId: string, data: Record<string, any>, userId?: string): void {
    this.log({
      action: 'CREATE',
      resource,
      resourceId,
      userId,
      changes: data,
      status: 'success',
    })
  }

  logUpdate(
    resource: string,
    resourceId: string,
    changes: Record<string, any>,
    userId?: string
  ): void {
    this.log({
      action: 'UPDATE',
      resource,
      resourceId,
      userId,
      changes,
      status: 'success',
    })
  }

  logDelete(resource: string, resourceId: string, userId?: string): void {
    this.log({
      action: 'DELETE',
      resource,
      resourceId,
      userId,
      status: 'success',
    })
  }

  logError(
    action: string,
    resource: string,
    error: Error,
    userId?: string,
    resourceId?: string
  ): void {
    this.log({
      action,
      resource,
      resourceId,
      userId,
      status: 'failure',
      error: error.message,
    })
  }

  private async sendToBackend(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    try {
      const response = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: entry.action,
          resource: entry.resource,
          actor: entry.userId || 'system',
          status: entry.status,
          timestamp: new Date(),
        }),
      })

      if (!response.ok) {
        return
      }
    } catch (error) {
      return
    }
  }

  getLogs(): AuditLogEntry[] {
    return this.logs
  }

  clearLogs(): void {
    this.logs = []
  }
}

export const auditLogger = new AuditLogger()
