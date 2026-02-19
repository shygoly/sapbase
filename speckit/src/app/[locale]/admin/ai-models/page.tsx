'use client'

import React, { useState, useEffect } from 'react'
import { aiModelsApi, type AIModel } from '@/lib/api/ai-models.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Plus, TestTube, CheckCircle2, XCircle } from 'lucide-react'
import PageContainer from '@/components/layout/page-container'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AIModelForm } from './components/ai-model-form'

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModel | null>(null)
  const [testingModelId, setTestingModelId] = useState<string | null>(null)
  const notification = useNotification()

  const fetchModels = async () => {
    setIsLoading(true)
    try {
      const data = await aiModelsApi.findAll()
      setModels(data)
    } catch (error) {
      notification.error('Failed to load AI models')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, [])

  const handleTestConnection = async (id: string) => {
    setTestingModelId(id)
    try {
      const result = await aiModelsApi.testConnection(id)
      if (result.success) {
        notification.success('Connection test successful')
      } else {
        notification.error(`Connection test failed: ${result.message}`)
      }
      await fetchModels()
    } catch (error) {
      notification.error('Failed to test connection')
    } finally {
      setTestingModelId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return
    try {
      await aiModelsApi.delete(id)
      notification.success('Model deleted successfully')
      await fetchModels()
    } catch (error) {
      notification.error('Failed to delete model')
    }
  }

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Model Configuration"
        pageDescription="Configure and manage AI models for patch generation"
        pageHeaderAction={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        }
      >
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Last Tested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No AI models configured
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{model.provider}</Badge>
                      </TableCell>
                      <TableCell>{model.model || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            model.status === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {model.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {model.isDefault ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        {model.lastTestedAt
                          ? new Date(model.lastTestedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(model.id)}
                            disabled={testingModelId === model.id}
                          >
                            <TestTube className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingModel(model)
                              setShowCreateDialog(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(model.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingModel ? 'Edit AI Model' : 'Add AI Model'}
              </DialogTitle>
              <DialogDescription>
                Configure an AI model for patch generation
              </DialogDescription>
            </DialogHeader>
            <AIModelForm
              model={editingModel}
              onSuccess={() => {
                setShowCreateDialog(false)
                setEditingModel(null)
                fetchModels()
              }}
              onCancel={() => {
                setShowCreateDialog(false)
                setEditingModel(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  )
}
