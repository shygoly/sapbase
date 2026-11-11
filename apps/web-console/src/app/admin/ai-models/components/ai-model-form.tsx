'use client'

import React, { useState, useEffect } from 'react'
import { aiModelsApi, type AIModel, type CreateAIModelDto } from '@sap/app-shared/lib/api/ai-models.api'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import { Textarea } from '@sap/app-shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { Checkbox } from '@sap/app-shared/components/ui/checkbox'

interface AIModelFormProps {
  model?: AIModel | null
  onSuccess: () => void
  onCancel: () => void
}

export function AIModelForm({ model, onSuccess, onCancel }: AIModelFormProps) {
  const [formData, setFormData] = useState<CreateAIModelDto>({
    name: '',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    description: '',
    isDefault: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const notification = useNotification()

  useEffect(() => {
    if (model) {
      setFormData({
        name: model.name,
        provider: model.provider,
        apiKey: model.apiKey || '',
        baseUrl: model.baseUrl || '',
        model: model.model || '',
        description: model.description || '',
        isDefault: model.isDefault,
      })
    }
  }, [model])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (model) {
        await aiModelsApi.update(model.id, formData)
        notification.success('Model updated successfully')
      } else {
        await aiModelsApi.create(formData)
        notification.success('Model created successfully')
      }
      onSuccess()
    } catch {
      notification.error(
        `Failed to ${model ? 'update' : 'create'} model`,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Provider *</Label>
        <Select
          value={formData.provider}
          onValueChange={(value: 'deepseek' | 'kimi' | 'openai' | 'anthropic') =>
            setFormData({ ...formData, provider: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deepseek">DeepSeek</SelectItem>
            <SelectItem value="kimi">Kimi</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key *</Label>
        <Input
          id="apiKey"
          type="password"
          value={formData.apiKey}
          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="baseUrl">Base URL</Label>
        <Input
          id="baseUrl"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder="https://api.deepseek.com/v1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="deepseek-chat"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isDefault"
          checked={formData.isDefault}
          onCheckedChange={(checked: boolean) =>
            setFormData({ ...formData, isDefault: !!checked })
          }
        />
        <Label htmlFor="isDefault" className="cursor-pointer">
          Set as default model
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : model ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
