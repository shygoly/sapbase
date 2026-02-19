/**
 * Plugins List Component
 */

'use client'

import React from 'react'
import { Plugin, PluginStatus, PluginType } from '@/lib/api/plugins.api'
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
import { Trash2, Power, PowerOff, Info } from 'lucide-react'

interface PluginsListProps {
  plugins: Plugin[]
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  onUninstall: (id: string) => void
  onViewDetails: (id: string) => void
}

export function PluginsList({
  plugins,
  onActivate,
  onDeactivate,
  onUninstall,
  onViewDetails,
}: PluginsListProps) {
  const getStatusColor = (status: PluginStatus) => {
    switch (status) {
      case PluginStatus.ACTIVE:
        return 'bg-green-100 text-green-800'
      case PluginStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800'
      case PluginStatus.ERROR:
        return 'bg-red-100 text-red-800'
      case PluginStatus.INSTALLED:
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: PluginType) => {
    switch (type) {
      case PluginType.INTEGRATION:
        return 'bg-purple-100 text-purple-800'
      case PluginType.UI:
        return 'bg-blue-100 text-blue-800'
      case PluginType.THEME:
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (plugins.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No plugins installed. Install a plugin to get started.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plugins.map((plugin) => (
          <TableRow key={plugin.id}>
            <TableCell className="font-medium">{plugin.name}</TableCell>
            <TableCell>{plugin.version}</TableCell>
            <TableCell>
              <Badge className={getTypeColor(plugin.type)}>
                {plugin.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getStatusColor(plugin.status)}>
                {plugin.status}
              </Badge>
            </TableCell>
            <TableCell className="max-w-md truncate">
              {plugin.description || '-'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(plugin.id)}
                  title="View details"
                >
                  <Info className="h-4 w-4" />
                </Button>
                {plugin.status === PluginStatus.ACTIVE ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDeactivate(plugin.id)}
                    title="Deactivate"
                  >
                    <PowerOff className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onActivate(plugin.id)}
                    title="Activate"
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onUninstall(plugin.id)}
                  title="Uninstall"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
