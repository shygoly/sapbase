'use client'

import React, { useState, useEffect } from 'react'
import { aiModulesApi, type AIModule } from '@/lib/api/ai-modules.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import PageContainer from '@/components/layout/page-container'
import { Upload, Download } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AIModulePublishPage() {
  const [modules, setModules] = useState<AIModule[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'published' | 'unpublished'>('all')
  const notification = useNotification()

  useEffect(() => {
    fetchModules()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional run on statusFilter change
  }, [statusFilter])

  const fetchModules = async () => {
    try {
      let data: AIModule[]
      if (statusFilter === 'all') {
        data = await aiModulesApi.findAll()
      } else {
        data = await aiModulesApi.findAll(statusFilter)
      }
      setModules(data.filter((m) => 
        m.status === 'approved' || m.status === 'published' || m.status === 'unpublished'
      ))
    } catch (error) {
      notification.error('Failed to load modules')
    }
  }

  const handlePublish = async (id: string) => {
    if (!confirm('Are you sure you want to publish this module?')) return
    try {
      await aiModulesApi.publish(id)
      notification.success('Module published successfully')
      await fetchModules()
    } catch (error) {
      notification.error('Failed to publish module')
    }
  }

  const handleUnpublish = async (id: string) => {
    if (!confirm('Are you sure you want to unpublish this module?')) return
    try {
      await aiModulesApi.unpublish(id)
      notification.success('Module unpublished successfully')
      await fetchModules()
    } catch (error) {
      notification.error('Failed to unpublish module')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge variant="default" className="bg-green-500">
            Published
          </Badge>
        )
      case 'unpublished':
        return <Badge variant="secondary">Unpublished</Badge>
      case 'approved':
        return <Badge variant="outline">Approved</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Module Publishing"
        pageDescription="Publish approved modules to production or unpublish them"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="unpublished">Unpublished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Published At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No modules available
                    </TableCell>
                  </TableRow>
                ) : (
                  modules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell>{getStatusBadge(module.status)}</TableCell>
                      <TableCell>{module.version}</TableCell>
                      <TableCell>
                        {module.publishedAt
                          ? new Date(module.publishedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {module.status === 'approved' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePublish(module.id)}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              上架
                            </Button>
                          )}
                          {module.status === 'published' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnpublish(module.id)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              下架
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
