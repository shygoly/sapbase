/**
 * Audit Logs Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { auditLogsApi } from '@/lib/api'
import { AuditLog, AuditAction } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { AuditLogsList } from './components/audit-logs-list'
import { TableSkeleton } from '@/components/loading-skeleton'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'

// PageModel schema
const AuditLogsPageModel: PageModel = {
  id: 'audit-logs-page',
  title: 'Audit Logs',
  description: 'View system activity and user actions',
  permissions: ['audit_logs:read'],
}

// CollectionModel schema
const AuditLogsCollectionModel: CollectionModel = {
  id: 'audit-logs-collection',
  name: 'Audit Logs',
  permissions: ['audit_logs:read'],
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState<AuditAction | ''>('')
  const [resourceType, setResourceType] = useState('')
  const notification = useNotification()

  // Fetch audit logs
  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const result = await auditLogsApi.findAll(page, pageSize, {
        action: action as AuditAction | undefined,
        resourceType: resourceType || undefined,
      })
      setLogs(result.data)
      setTotal(result.total)
    } catch (error) {
      notification.error('Failed to load audit logs')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, pageSize, action, resourceType])

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
        {/* Filters */}
        <div className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as AuditAction | '')
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resource Type
            </label>
            <select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              <option value="users">Users</option>
              <option value="roles">Roles</option>
              <option value="departments">Departments</option>
              <option value="settings">Settings</option>
            </select>
          </div>
        </div>

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
