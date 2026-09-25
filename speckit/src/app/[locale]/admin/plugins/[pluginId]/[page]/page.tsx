/**
 * Plugin Page Route
 * Dynamic route for plugin pages (e.g. config page)
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { PluginComponentRenderer } from '@/core/plugins/plugin-runtime'
import { useParams } from 'next/navigation'
import { useLocale } from '@/hooks/use-locale'
import { pluginsApi, Plugin } from '@/lib/api/plugins.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

const ConfigPlaceholder = ({ pluginName }: { pluginName?: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>{pluginName ? `${pluginName} 插件配置` : '插件配置'}</CardTitle>
      <CardDescription>
        该插件暂无配置项，或未提供配置页面。若为第三方插件，请参考其文档。
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-sm">
        No configuration options for this plugin. If this is a third-party plugin, refer to its documentation.
      </p>
    </CardContent>
  </Card>
)

export default function PluginPage() {
  const params = useParams()
  const pluginId = params?.pluginId as string
  const pageName = params?.page as string
  const [plugin, setPlugin] = useState<Plugin | null>(null)
  const locale = useLocale()

  useEffect(() => {
    if (!pluginId) return
    pluginsApi.findOne(pluginId).then(setPlugin).catch(() => setPlugin(null))
  }, [pluginId])

  if (!pluginId || !pageName) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Plugin Page Not Found</h1>
          <p className="text-muted-foreground mb-4">Invalid plugin ID or page name.</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/admin/plugins`}>返回插件列表</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isConfigPage = pageName === 'config'

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/admin/plugins`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {plugin?.name ?? 'Plugin'} {isConfigPage ? '配置' : pageName}
        </h1>
      </div>

      <PluginComponentRenderer
        pluginId={pluginId}
        componentName={pageName}
        fallback={
          isConfigPage ? (
            <ConfigPlaceholder pluginName={plugin?.name} />
          ) : (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading plugin page...</p>
              </div>
            </div>
          )
        }
        fallbackOnError={isConfigPage ? <ConfigPlaceholder pluginName={plugin?.name} /> : undefined}
      />
    </div>
  )
}
