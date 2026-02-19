'use client'

import React, { useState, useEffect } from 'react'
import { moduleRegistryApi, ModuleRegistry } from '@/lib/api/module-registry.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/hooks/use-locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageContainer from '@/components/layout/page-container'

export default function ModuleRegistryPage() {
  const [modules, setModules] = useState<ModuleRegistry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const notification = useNotification()
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    fetchModules()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, [])

  const fetchModules = async () => {
    setIsLoading(true)
    try {
      const data = await moduleRegistryApi.findAll()
      setModules(data)
    } catch (error) {
      notification.error('Failed to load modules')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'deprecated':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'crud':
        return 'bg-blue-100 text-blue-800'
      case 'workflow':
        return 'bg-purple-100 text-purple-800'
      case 'integration':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGuard permission="system:manage">
      <PageContainer
        pageTitle="Module Registry"
        pageDescription="Manage and monitor all AI-created modules"
      >
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading modules...</div>
          ) : modules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No modules registered</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Entities</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell className="text-gray-600">
                        {module.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(module.moduleType)}>
                          {module.moduleType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(module.status)}>
                          {module.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{module.version}</TableCell>
                      <TableCell>
                        {module.metadata?.entities?.length ? (
                          <span className="text-sm text-gray-600">
                            {module.metadata.entities.length} entities
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/${locale}/admin/module-registry/${module.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
