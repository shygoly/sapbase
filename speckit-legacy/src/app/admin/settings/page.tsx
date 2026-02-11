'use client'

import { useMemo, useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { FormRuntime } from '@/components/runtime/form-runtime'
import { buildPageModel, toFormSchema } from '@/components/runtime/schema-adapters'
import { schemaResolver } from '@/core/schema/resolver'
import { schemaRegistry } from '@/core/schema/registry'
import { apiService } from '@/lib/api-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { ObjectSchema, ResolvedPageSchema } from '@/core/schema/types'

export default function SettingsPage() {
  const [pageSchema, setPageSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [settings, setSettings] = useState<Record<string, any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pageModel = useMemo(() => {
    return buildPageModel({
      id: 'admin-settings',
      path: '/admin/settings',
      fallbackTitle: 'System Settings',
      fallbackDescription: 'System configuration',
      pageSchema,
    })
  }, [pageSchema])

  const formSchema = useMemo(() => {
    return objectSchema
      ? toFormSchema(objectSchema)
      : { id: 'settings-form', title: 'Settings', fields: [] }
  }, [objectSchema])

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const resolved = await schemaResolver.resolvePage('settings')
        setPageSchema(resolved)
        const objSchema = schemaRegistry.getObject('settings')
        if (objSchema) setObjectSchema(objSchema)
        const data = await apiService.getSettings()
        setSettings(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSubmitForm = async (data: Record<string, any>) => {
    try {
      const result = await apiService.updateSettings(data)
      setSettings(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

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
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">
          {pageSchema?.metadata?.title || 'System Settings'}
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
        <FormRuntime schema={formSchema}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Configure System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <SchemaForm
                schema={objectSchema}
                initialData={settings || {}}
                onSubmit={handleSubmitForm}
              />
            </CardContent>
          </Card>
        </FormRuntime>
      )}
    </PageRuntime>
  )
}
