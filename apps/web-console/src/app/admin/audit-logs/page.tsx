/**
 * Audit Logs Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { auditLogsApi } from '@sap/app-shared/lib/api'
import { AuditLog, AuditAction } from '@sap/app-shared/lib/api/types'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { AuditLogsList } from './components/audit-logs-list'
import { TableSkeleton } from '@sap/app-shared/components/loading-skeleton'
import { Button } from '@sap/app-shared/components/ui/button'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@sap/app-shared/components/runtime'

// PageModel schema
const AuditLogsPageModel: PageModel = {
  id: 'audit-logs-page',
  title: 'Audit Logs',
  description: 'View system activity and user actions',
  permissions: ['audit-logs:read'], // Use hyphen to match backend permission name
}

// CollectionModel schema
const AuditLogsCollectionModel: CollectionModel = {
  id: 'audit-logs-collection',
  name: 'Audit Logs',
  permissions: ['audit-logs:read'], // Use hyphen to match backend permission name
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState<AuditAction | ''>('')
  const [resourceType, setResourceType] = useState('')
  const [chain, setChain] = useState<{ valid: boolean; checked: number; reason?: string } | null>(null)
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([])
  const [archives, setArchives] = useState<Array<Record<string, unknown>>>([])
  const notification = useNotification()

  // Fetch audit logs
  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const result = await auditLogsApi.findAll(page, pageSize, {
        action: action as AuditAction | undefined,
        resourceType: resourceType || undefined,
      })
      setLogs(result.data || [])
      setTotal(result.total || 0)
    } catch {
      notification.error('Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    auditLogsApi.listArchives().then(setArchives).catch(() => setArchives([]))
  }, [page, pageSize, action, resourceType])

  const verifyChain = async () => {
    try {
      setChain(await auditLogsApi.verify())
      setAlerts((await auditLogsApi.alerts()).alerts)
      notification.success('Audit chain verified')
    } catch {
      notification.error('Audit chain verification failed')
    }
  }

  const createCheckpoint = async () => {
    try {
      await auditLogsApi.createCheckpoint()
      notification.success('Checkpoint created')
    } catch {
      notification.error('Checkpoint failed')
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await auditLogsApi.export(
        {
          action: action as AuditAction | undefined,
          resourceType: resourceType || undefined,
        },
        format
      )
      auditLogsApi.downloadFile(blob, `audit-logs.${format}`)
      notification.success(`Audit logs exported as ${format.toUpperCase()}`)
    } catch (error) {
      notification.error('Failed to export audit logs')
      console.error(error)
    }
  }

  return (
    <PageRuntime model={AuditLogsPageModel} isLoading={isLoading}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <button
            onClick={verifyChain}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Verify chain
          </button>
          <button
            onClick={createCheckpoint}
            className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted"
          >
            Create checkpoint
          </button>
          {chain ? (
            <span className={chain.valid ? 'text-sm text-green-700' : 'text-sm text-red-700'}>
              {chain.valid
                ? `链有效：${chain.checked} 条`
                : `链失败：${chain.reason ?? 'unknown'}`}
            </span>
          ) : null}
          {alerts.length > 0 ? (
            <span className="text-sm text-amber-700">{alerts.length} 条审计告警</span>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as AuditAction | '')
                setPage(1)
              }}
              className="w-full rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="READ">Read</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Resource Type
            </label>
            <select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              <option value="users">Users</option>
              <option value="roles">Roles</option>
              <option value="departments">Departments</option>
              <option value="settings">Settings</option>
            </select>
          </div>
        </div>

        {archives.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium">归档</h3>
            {archives.slice(0, 5).map((archive) => (
              <div key={String(archive.id)} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono">{String(archive.fromSeq)}-{String(archive.toSeq)}</span>
                <Badge>{String(archive.status)}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await auditLogsApi.restore(String(archive.id))
                    notification.success('Archive restored')
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Audit Logs Table */}
        <CollectionRuntime model={AuditLogsCollectionModel} isLoading={isLoading}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <AuditLogsList
              logs={logs}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onExport={handleExport}
            />
          )}
        </CollectionRuntime>
      </div>
    </PageRuntime>
  )
}
