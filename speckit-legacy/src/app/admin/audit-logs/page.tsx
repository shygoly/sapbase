'use client'

import { useMemo, useState, useEffect } from 'react'
import { SchemaList } from '@/components/schema-list'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { CollectionRuntime } from '@/components/runtime/collection-runtime'
import { buildPageModel, toCollectionSchema } from '@/components/runtime/schema-adapters'
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

  const pageModel = useMemo(() => {
    return buildPageModel({
      id: 'admin-audit-logs',
      path: '/admin/audit-logs',
      fallbackTitle: 'Audit Logs',
      fallbackDescription: 'Audit log history',
      pageSchema,
    })
  }, [pageSchema])

  const collectionSchema = useMemo(() => {
    return objectSchema
      ? toCollectionSchema(objectSchema, pageSchema)
      : { id: 'audit-logs-collection', title: 'Audit Logs', columns: [] }
  }, [objectSchema, pageSchema])

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
        setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <PageRuntime model={pageModel} className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </PageRuntime>
    )
  }

  return (
    <PageRuntime model={pageModel} className="p-6 space-y-6">
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
        <CollectionRuntime schema={collectionSchema} data={logs} isLoading={isLoading}>
          <SchemaList
            schema={objectSchema}
            data={logs}
            isLoading={isLoading}
          />
        </CollectionRuntime>
      )}
    </PageRuntime>
  )
}
