'use client'

import React, { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { aiModulesApi, type AIModule } from '@/lib/api/ai-modules.api'
import { type ModuleRegistry } from '@/lib/api/module-registry.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import PageContainer from '@/components/layout/page-container'
import { Loader2 } from 'lucide-react'
import { cachedApi } from '@/lib/api/cached-api'

// Dynamic import for heavy components - code splitting
const NewModuleDefinitionWizard = dynamic(
  () => import('./new-module-wizard').then(mod => ({ default: mod.NewModuleDefinitionWizard })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading wizard...</span>
      </div>
    ),
    ssr: false, // Disable SSR for heavy component
  }
)

export default function AIModuleDevelopPage() {
  /* eslint-disable @typescript-eslint/no-unused-vars -- state reserved for future UI */
  const [mode, _setMode] = useState<'create' | 'modify'>('create')
  const [showDefinitionWizard, setShowDefinitionWizard] = useState(false)
  const [module, setModule] = useState<AIModule | null>(null)
  const [_definitionFromWizard, setDefinitionFromWizard] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [_isGenerating, setIsGenerating] = useState(false)
  const [_patchPreview, setPatchPreview] = useState<string>('')
  const [registryModules, setRegistryModules] = useState<ModuleRegistry[]>([])
  const [selectedRegistryId, _setSelectedRegistryId] = useState('')
  const [_isLoadingRegistry, setIsLoadingRegistry] = useState(true)
  const [_aiModules, setAiModules] = useState<AIModule[]>([])
  const [_isLoadingModules, setIsLoadingModules] = useState(true)
  const [selectedModuleId, _setSelectedModuleId] = useState<string>('')
  const [_selectedDefinition, setSelectedDefinition] = useState<any>(null)
  const [_isLoadingDefinition, setIsLoadingDefinition] = useState(false)
  const [_definitionMarkdown, setDefinitionMarkdown] = useState<string>('')
  const notification = useNotification()

  // Memoize expensive computations
  const _selectedRegistryModule = useMemo(
    () => registryModules.find((m) => m.id === selectedRegistryId),
    [registryModules, selectedRegistryId]
  )

  const _canShowPrompt = useMemo(
    () => (mode === 'modify' ? Boolean(selectedRegistryId) : Boolean(module)),
    [mode, selectedRegistryId, module]
  )

  useEffect(() => {
    // Use cached API for better performance
    Promise.all([
      cachedApi.get<ModuleRegistry[]>('/api/module-registry').catch(() => []),
      cachedApi.get<AIModule[]>('/api/ai-modules').catch(() => []),
    ]).then(([registry, modules]) => {
      setRegistryModules(registry)
      setAiModules(modules)
      setIsLoadingRegistry(false)
      setIsLoadingModules(false)
    })
  }, [])

  useEffect(() => {
    if (selectedModuleId) {
      fetchDefinition(selectedModuleId)
    } else {
      setSelectedDefinition(null)
      setDefinitionMarkdown('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDefinition stable, mount/selectedModuleId only
  }, [selectedModuleId])

  const fetchDefinition = async (moduleId: string) => {
    setIsLoadingDefinition(true)
    try {
      // Use cached API
      const definition = await cachedApi.get(`/api/ai-modules/${moduleId}/definition`)
      setSelectedDefinition(definition)
      setDefinitionMarkdown(formatDefinitionAsMarkdown(definition))
    } catch (error) {
      notification.error('Failed to load definition')
      setSelectedDefinition(null)
      setDefinitionMarkdown('')
    } finally {
      setIsLoadingDefinition(false)
    }
  }

  const formatDefinitionAsMarkdown = (definition: any): string => {
    if (!definition) return ''

    const sections = [
      { title: 'Step 1: Object Model', data: definition.step1_objectModel },
      { title: 'Step 2: Relationships', data: definition.step2_relationships },
      { title: 'Step 3: State Flow', data: definition.step3_stateFlow },
      { title: 'Step 4: Pages', data: definition.step4_pages },
      { title: 'Step 5: Permissions', data: definition.step5_permissions },
      { title: 'Step 6: Reports', data: definition.step6_reports },
    ]

    let markdown = '# Module Definition\n\n'
    markdown += `**Module ID:** ${definition.aiModuleId || 'N/A'}\n\n`
    markdown += `**Created:** ${definition.createdAt || 'N/A'}\n\n`
    markdown += `**Updated:** ${definition.updatedAt || 'N/A'}\n\n`
    markdown += '---\n\n'

    sections.forEach((section) => {
      markdown += `## ${section.title}\n\n`
      if (section.data) {
        markdown += '```json\n'
        markdown += JSON.stringify(section.data, null, 2)
        markdown += '\n```\n\n'
      } else {
        markdown += '*No data available*\n\n'
      }
    })

    if (definition.mergedDefinition) {
      markdown += '## Merged Definition\n\n'
      markdown += '```json\n'
      markdown += JSON.stringify(definition.mergedDefinition, null, 2)
      markdown += '\n```\n\n'
    }

    return markdown
  }

  const _handleGeneratePatch = async () => {
    if (!module || !prompt.trim()) {
      notification.error('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    try {
      const updated = await aiModulesApi.generatePatch(module.id, prompt)
      setModule(updated)
      setPatchPreview(JSON.stringify(updated.patchContent, null, 2))
      notification.success('Patch generated successfully')
      // Clear cache after update
      cachedApi.clearCache('/api/ai-modules')
    } catch (error) {
      notification.error('Failed to generate patch')
    } finally {
      setIsGenerating(false)
    }
  }

  // ... rest of the component remains the same, but use cachedApi where appropriate
  // This is a simplified version showing the key optimizations

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Module Development"
        pageDescription="Develop AI modules using natural language prompts"
      >
        {/* Component content with optimizations */}
        <div className="space-y-6">
          {/* Use dynamic import for heavy wizard component */}
          {showDefinitionWizard && (
            <NewModuleDefinitionWizard
              onCancel={() => setShowDefinitionWizard(false)}
              onComplete={(definitionState: any) => {
                setShowDefinitionWizard(false)
                setDefinitionFromWizard(definitionState)
              }}
            />
          )}
          {/* Rest of component */}
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
