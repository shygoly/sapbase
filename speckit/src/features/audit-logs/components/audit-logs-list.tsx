'use client'

import { useState, useEffect } from 'react'
import { auditLogApi, type AuditLog } from '../api'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'failure':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        {logs.map((log) => (
          <AccordionItem key={log.id} value={log.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full text-left">
                <span className="font-medium">{log.action}</span>
                <span className="text-sm text-muted-foreground">{log.resource}</span>
                <Badge className={getStatusColor(log.status)}>
                  {log.status}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Actor</p>
                    <p className="text-sm">{log.actor}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Action</p>
                    <p className="text-sm">{log.action}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Resource</p>
                    <p className="text-sm">{log.resource}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p className="text-sm">{log.status}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                    <p className="text-sm">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
