'use client'

import { useState, useEffect } from 'react'
import { auditLogApi, type AuditLog } from '../api'

export function AuditLogsList() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      const data = await auditLogApi.getLogs()
      setLogs(data)
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <table className="w-full border-collapse border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Actor</th>
            <th className="border p-2 text-left">Action</th>
            <th className="border p-2 text-left">Resource</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td className="border p-2">{log.actor}</td>
              <td className="border p-2">{log.action}</td>
              <td className="border p-2">{log.resource}</td>
              <td className="border p-2">{log.status}</td>
              <td className="border p-2">{new Date(log.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
