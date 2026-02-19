/**
 * Plugin Registry Browser Component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { pluginsApi, RegistryPlugin } from '@/lib/api/plugins.api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2 } from 'lucide-react'
import { useNotification } from '@/core/ui/ui-hooks'

interface RegistryBrowserProps {
  onInstallFromRegistry?: (pluginName: string, version: string) => void
}

export function RegistryBrowser({ onInstallFromRegistry }: RegistryBrowserProps) {
  const [plugins, setPlugins] = useState<RegistryPlugin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const notification = useNotification()

  useEffect(() => {
    fetchRegistryPlugins()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, [])

  const fetchRegistryPlugins = async () => {
    setIsLoading(true)
    try {
      const response = await pluginsApi.browseRegistry()
      setPlugins(response.plugins || [])
    } catch (error) {
      notification.error('Failed to load registry plugins')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInstall = async (plugin: RegistryPlugin) => {
    if (onInstallFromRegistry) {
      onInstallFromRegistry(plugin.name, plugin.version)
    } else {
      notification.info(
        `To install ${plugin.name} v${plugin.version}, please use the Install Plugin dialog and upload the plugin ZIP file.`,
      )
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'integration':
        return 'bg-purple-100 text-purple-800'
      case 'ui':
        return 'bg-blue-100 text-blue-800'
      case 'theme':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (plugins.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No plugins available in the registry.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Available Plugins</h3>
        <Button variant="outline" size="sm" onClick={fetchRegistryPlugins}>
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Author</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plugins.map((plugin, index) => (
            <TableRow key={`${plugin.name}-${plugin.version}-${index}`}>
              <TableCell className="font-medium">{plugin.name}</TableCell>
              <TableCell>{plugin.version}</TableCell>
              <TableCell>
                <Badge className={getTypeColor(plugin.type)}>
                  {plugin.type}
                </Badge>
              </TableCell>
              <TableCell className="max-w-md truncate">
                {plugin.description || '-'}
              </TableCell>
              <TableCell>{plugin.author || '-'}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInstall(plugin)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
