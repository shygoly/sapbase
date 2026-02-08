'use client'

import { useState, useEffect } from 'react'
import { SchemaList } from '@/components/schema-list'
import { schemaResolver } from '@/core/schema/resolver'
import { schemaRegistry } from '@/core/schema/registry'
import { apiService } from '@/lib/api-service'
import { Card, CardContent } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { ObjectSchema, ResolvedPageSchema } from '@/core/schema/types'

export default function AuditLogsPage() {
  const [pageSchema, setPageSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [logs, setLogs] = useState<Record<string, any>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const resolved = await schemaResolver.resolvePage('audit-logs')
        setPageSchema(resolved)
        const objSchema = schemaRegistry.getObject('audit-log')
        if (objSchema) setObjectSchema(objSchema)
        const data = await apiService.getAuditLogs()
        setLogs(data)
      } catch (err) {
        console.error('Failed to load audit logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin Center</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Audit Logs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {pageSchema?.metadata?.title || 'Audit Logs'}
        </h1>
        <p className="text-muted-foreground">
          {pageSchema?.metadata?.description}
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {objectSchema && (
        <SchemaList
          schema={objectSchema}
          data={logs}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
