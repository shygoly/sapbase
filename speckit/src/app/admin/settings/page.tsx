'use client'

import { useState, useEffect } from 'react'
import { SchemaForm } from '@/components/schema-form'
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
        console.error('Failed to load settings:', err)
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
      console.error('Failed to save settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

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
      )}
    </div>
  )
}
