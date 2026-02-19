import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  PLUGIN_EVENT_EMITTER,
  PluginEventType,
  type IPluginEventEmitter,
  type PluginEvent,
} from '../../domain/services/i-plugin-event-emitter'

export interface AuditLogEntry {
  timestamp: Date
  eventType: PluginEventType
  pluginId: string
  pluginName: string
  organizationId: string
  userId?: string
  action: string
  metadata?: Record<string, any>
  success: boolean
  error?: string
}

/**
 * Plugin Audit Logger Service
 * Logs all plugin operations for security and compliance
 */
@Injectable()
export class PluginAuditLoggerService implements OnModuleInit {
  private readonly logger = new Logger(PluginAuditLoggerService.name)
  private readonly auditLogPath: string
  private unsubscribeFunctions: Array<() => void> = []

  constructor(
    @Inject(PLUGIN_EVENT_EMITTER)
    private readonly eventEmitter: IPluginEventEmitter,
  ) {
    this.auditLogPath = path.join(process.cwd(), 'logs', 'plugin-audit.log')
  }

  async onModuleInit() {
    // Ensure logs directory exists
    const logsDir = path.dirname(this.auditLogPath)
    await fs.mkdir(logsDir, { recursive: true }).catch(() => {
      // Directory might already exist
    })

    // Subscribe to all plugin events
    const unsubscribe = this.eventEmitter.on('*', async (event) => {
      await this.logEvent(event)
    })

    this.unsubscribeFunctions.push(unsubscribe)

    this.logger.log('Plugin audit logger initialized')
  }

  async onModuleDestroy() {
    // Unsubscribe from events
    for (const unsubscribe of this.unsubscribeFunctions) {
      unsubscribe()
    }
  }

  /**
   * Log a plugin event to audit log
   */
  private async logEvent(event: PluginEvent): Promise<void> {
    try {
      const logEntry: AuditLogEntry = {
        timestamp: event.timestamp,
        eventType: event.type,
        pluginId: event.pluginId,
        pluginName: event.pluginName,
        organizationId: event.organizationId,
        action: this.getActionFromEventType(event.type),
        metadata: event.metadata,
        success: true,
      }

      await this.writeLogEntry(logEntry)
    } catch (error) {
      this.logger.error('Failed to write audit log entry:', error)
    }
  }

  /**
   * Manually log an audit entry (for operations not covered by events)
   */
  async logOperation(
    eventType: PluginEventType,
    pluginId: string,
    pluginName: string,
    organizationId: string,
    userId?: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        eventType,
        pluginId,
        pluginName,
        organizationId,
        userId,
        action: this.getActionFromEventType(eventType),
        metadata,
        success,
        error,
      }

      await this.writeLogEntry(logEntry)
    } catch (err) {
      this.logger.error('Failed to write audit log entry:', err)
    }
  }

  /**
   * Write log entry to file
   */
  private async writeLogEntry(entry: AuditLogEntry): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n'
    await fs.appendFile(this.auditLogPath, logLine, 'utf-8')
  }

  /**
   * Get human-readable action from event type
   */
  private getActionFromEventType(eventType: PluginEventType): string {
    switch (eventType) {
      case PluginEventType.INSTALLED:
        return 'install'
      case PluginEventType.ACTIVATED:
        return 'activate'
      case PluginEventType.DEACTIVATED:
        return 'deactivate'
      case PluginEventType.UNINSTALLED:
        return 'uninstall'
      case PluginEventType.ERROR:
        return 'error'
      default:
        return 'unknown'
    }
  }

  /**
   * Query audit logs (for admin/reporting purposes)
   */
  async queryLogs(
    filters?: {
      pluginId?: string
      organizationId?: string
      eventType?: PluginEventType
      startDate?: Date
      endDate?: Date
    },
  ): Promise<AuditLogEntry[]> {
    try {
      const logContent = await fs.readFile(this.auditLogPath, 'utf-8')
      const lines = logContent.split('\n').filter((line) => line.trim())

      const entries: AuditLogEntry[] = lines
        .map((line) => {
          try {
            return JSON.parse(line) as AuditLogEntry
          } catch {
            return null
          }
        })
        .filter((entry): entry is AuditLogEntry => entry !== null)

      // Apply filters
      let filtered = entries

      if (filters?.pluginId) {
        filtered = filtered.filter((e) => e.pluginId === filters.pluginId)
      }

      if (filters?.organizationId) {
        filtered = filtered.filter(
          (e) => e.organizationId === filters.organizationId,
        )
      }

      if (filters?.eventType) {
        filtered = filtered.filter((e) => e.eventType === filters.eventType)
      }

      if (filters?.startDate) {
        filtered = filtered.filter(
          (e) => new Date(e.timestamp) >= filters.startDate!,
        )
      }

      if (filters?.endDate) {
        filtered = filtered.filter(
          (e) => new Date(e.timestamp) <= filters.endDate!,
        )
      }

      return filtered.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // Log file doesn't exist yet
        return []
      }
      this.logger.error('Failed to query audit logs:', error)
      throw error
    }
  }
}
