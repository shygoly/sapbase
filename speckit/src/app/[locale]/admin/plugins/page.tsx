/**
 * Plugins Management Page
 */

'use client'

import React, { useState, useEffect } from 'react'
import { pluginsApi, Plugin } from '@/lib/api/plugins.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { PluginsList } from './components/plugins-list'
import { InstallPluginDialog } from './components/install-plugin-dialog'
import { RegistryBrowser } from './components/registry-browser'
import { TableSkeleton } from '@/components/loading-skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { CollectionRuntime, type CollectionModel } from '@/components/runtime'

// PageModel schema
const PluginsPageModel: PageModel = {
  id: 'plugins-page',
  title: 'Plugin Management',
  description: 'Manage plugins and extensions',
  permissions: ['plugins:read'],
}

// CollectionModel schema
const PluginsCollectionModel: CollectionModel = {
  id: 'plugins-collection',
  name: 'Plugins',
  permissions: ['plugins:read'],
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const notification = useNotification()

  // Fetch plugins
  const fetchPlugins = async () => {
    setIsLoading(true)
    try {
      const data = await pluginsApi.findAll()
      setPlugins(data)
    } catch (error) {
      notification.error('Failed to load plugins')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPlugins()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, [])

  const handleActivate = async (id: string) => {
    try {
      await pluginsApi.activate(id)
      notification.success('Plugin activated successfully')
      await fetchPlugins()
    } catch (error: any) {
      notification.error(
        error.response?.data?.message || 'Failed to activate plugin',
      )
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await pluginsApi.deactivate(id)
      notification.success('Plugin deactivated successfully')
      await fetchPlugins()
    } catch (error: any) {
      notification.error(
        error.response?.data?.message || 'Failed to deactivate plugin',
      )
    }
  }

  const handleUninstall = async (id: string) => {
    const plugin = plugins.find((p) => p.id === id)
    if (
      !confirm(
        `Are you sure you want to uninstall "${plugin?.name}"? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      await pluginsApi.uninstall(id)
      notification.success('Plugin uninstalled successfully')
      await fetchPlugins()
    } catch (error: any) {
      notification.error(
        error.response?.data?.message || 'Failed to uninstall plugin',
      )
    }
  }

  const handleViewDetails = async (id: string) => {
    try {
      const plugin = await pluginsApi.findOne(id)
      alert(
        `Plugin Details:\n\nName: ${plugin.name}\nVersion: ${plugin.version}\nType: ${plugin.type}\nStatus: ${plugin.status}\nDescription: ${plugin.description || 'N/A'}\nAuthor: ${plugin.author || 'N/A'}`,
      )
    } catch (error: any) {
      notification.error('Failed to load plugin details')
    }
  }

  const handleInstallSuccess = async () => {
    await fetchPlugins()
    notification.success('Plugin installed successfully')
  }

  // Page header action button
  const pageHeaderAction = (
    <PermissionGuard permission="plugins:create">
      <Button onClick={() => setShowInstallDialog(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Install Plugin
      </Button>
    </PermissionGuard>
  )

  return (
    <PageRuntime
      model={PluginsPageModel}
      isLoading={isLoading}
      pageHeaderAction={pageHeaderAction}
    >
      <div className="space-y-6">
        <Tabs defaultValue="installed" className="w-full">
          <TabsList>
            <TabsTrigger value="installed">Installed Plugins</TabsTrigger>
            <TabsTrigger value="registry">Plugin Registry</TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="space-y-4">
            <CollectionRuntime
              model={PluginsCollectionModel}
              isLoading={isLoading}
            >
              {isLoading ? (
                <TableSkeleton />
              ) : (
                <PluginsList
                  plugins={plugins}
                  onActivate={handleActivate}
                  onDeactivate={handleDeactivate}
                  onUninstall={handleUninstall}
                  onViewDetails={handleViewDetails}
                />
              )}
            </CollectionRuntime>
          </TabsContent>

          <TabsContent value="registry" className="space-y-4">
            <RegistryBrowser />
          </TabsContent>
        </Tabs>

        {/* Install Plugin Dialog */}
        <InstallPluginDialog
          open={showInstallDialog}
          onOpenChange={setShowInstallDialog}
          onSuccess={handleInstallSuccess}
        />
      </div>
    </PageRuntime>
  )
}
