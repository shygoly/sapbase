'use client'

import React, { useEffect, useState } from 'react'
import { aiModulesApi, type AIModule } from '@/lib/api/ai-modules.api'
import { moduleRegistryApi, type ModuleRegistry } from '@/lib/api/module-registry.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import PageContainer from '@/components/layout/page-container'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NewModuleDefinitionWizard, type NewModuleDefinitionState } from './new-module-wizard'

/** Build the merged definition payload (generated JSON from all 6 steps) for the API. */
function buildDefinitionPayload(state: NewModuleDefinitionState): Record<string, any> {
  const o = state.objectModel?.generated ?? {}
  const r = state.relationships?.generated ?? {}
  const s = state.stateFlow?.generated ?? {}
  const p = state.pages?.generated ?? {}
  const perm = state.permissions?.generated ?? {}
  const rep = state.reports?.generated ?? {}
  return { ...o, ...r, ...s, ...p, ...perm, ...rep }
}

export default function AIModuleDevelopPage() {
  const [mode, setMode] = useState<'create' | 'modify'>('create')
  const [showDefinitionWizard, setShowDefinitionWizard] = useState(false)
  const [module, setModule] = useState<AIModule | null>(null)
  /** When non-null, the user completed the 6-step wizard; use this to show summary and "Generate from definition". */
  const [definitionFromWizard, setDefinitionFromWizard] = useState<NewModuleDefinitionState | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [patchPreview, setPatchPreview] = useState<string>('')
  const [registryModules, setRegistryModules] = useState<ModuleRegistry[]>([])
  const [selectedRegistryId, setSelectedRegistryId] = useState('')
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(true)
  const [aiModules, setAiModules] = useState<AIModule[]>([])
  const [isLoadingModules, setIsLoadingModules] = useState(true)
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')
  const [selectedDefinition, setSelectedDefinition] = useState<any>(null)
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false)
  const [definitionMarkdown, setDefinitionMarkdown] = useState<string>('')
  const notification = useNotification()

  useEffect(() => {
    fetchRegistryModules()
    fetchAIModules()
  }, [])

  // Refresh modules list when mode changes
  useEffect(() => {
    fetchAIModules()
  }, [mode])

  useEffect(() => {
    if (selectedModuleId) {
      fetchDefinition(selectedModuleId)
    } else {
      setSelectedDefinition(null)
      setDefinitionMarkdown('')
    }
  }, [selectedModuleId])

  const fetchRegistryModules = async () => {
    setIsLoadingRegistry(true)
    try {
      const modules = await moduleRegistryApi.findAll().catch(() => [])
      setRegistryModules(modules)
    } catch (error) {
      notification.error('Failed to load modules')
    } finally {
      setIsLoadingRegistry(false)
    }
  }

  const fetchAIModules = async () => {
    setIsLoadingModules(true)
    try {
      // Fetch both AI modules and registry modules, combine them
      const [aiModulesList, registryModulesList] = await Promise.all([
        aiModulesApi.findAll().catch(() => []),
        moduleRegistryApi.findAll().catch(() => []),
      ])
      
      // Combine modules: AI modules first, then registry modules that don't have aiModuleId
      const combinedModules: AIModule[] = [...aiModulesList]
      
      // Add registry modules that don't have a corresponding AI module
      registryModulesList.forEach((registryModule) => {
        if (!registryModule.aiModuleId || !aiModulesList.find(m => m.id === registryModule.aiModuleId)) {
          // Create a pseudo AIModule from registry module for display
          combinedModules.push({
            id: registryModule.aiModuleId || registryModule.id,
            name: registryModule.name,
            description: registryModule.description,
            status: registryModule.status as any,
            patchContent: {},
            version: registryModule.version || '1.0.0',
            createdAt: registryModule.createdAt,
            updatedAt: registryModule.updatedAt,
          })
        }
      })
      
      setAiModules(combinedModules)
    } catch (error) {
      notification.error('Failed to load modules')
    } finally {
      setIsLoadingModules(false)
    }
  }

  const fetchDefinition = async (moduleId: string) => {
    setIsLoadingDefinition(true)
    try {
      const definition = await aiModulesApi.getDefinition(moduleId)
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

    sections.forEach((section, index) => {
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

  const handleModeChange = (nextMode: 'create' | 'modify') => {
    setMode(nextMode)
    setModule(null)
    setDefinitionFromWizard(null)
    setPrompt('')
    setPatchPreview('')
    setSelectedRegistryId('')
    setSelectedModuleId('')
    setShowDefinitionWizard(false)
  }

  const handleCreateModule = async () => {
    try {
      const newModule = await aiModulesApi.create({
        name: `Module ${Date.now()}`,
        description: '',
      })
      setModule(newModule)
      setMode('create')
      notification.success('Module created')
    } catch (error) {
      notification.error('Failed to create module')
    }
  }

  const handleGeneratePatch = async () => {
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
    } catch (error) {
      notification.error('Failed to generate patch')
    } finally {
      setIsGenerating(false)
    }
  }


  const handleGenerateFromDefinition = async () => {
    if (!module || !definitionFromWizard) return
    const definition = buildDefinitionPayload(definitionFromWizard)
    if (Object.keys(definition).length === 0) {
      notification.error('Definition is empty')
      return
    }
    setIsGenerating(true)
    try {
      const updated = await aiModulesApi.generateFromDefinition(module.id, definition)
      setModule(updated)
      setPatchPreview(JSON.stringify(updated.patchContent, null, 2))
      notification.success('Module generated from definition. Check Preview tab.')
    } catch (error) {
      notification.error('Failed to generate from definition')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleModifyPatch = async () => {
    if (!selectedRegistryId || !prompt.trim()) {
      notification.error('Please select a module and enter a prompt')
      return
    }

    setIsGenerating(true)
    try {
      const updated = await aiModulesApi.modifyExisting(selectedRegistryId, prompt)
      setModule(updated)
      setPatchPreview(JSON.stringify(updated.patchContent, null, 2))
      notification.success('Update patch generated successfully')
    } catch (error) {
      notification.error('Failed to generate update patch')
    } finally {
      setIsGenerating(false)
    }
  }

  const isModifyMode = mode === 'modify'
  const selectedRegistryModule = registryModules.find((m) => m.id === selectedRegistryId)
  const canShowPrompt = isModifyMode ? Boolean(selectedRegistryId) : Boolean(module)
  const promptTitle = isModifyMode ? 'Modification Prompt' : 'Natural Language Prompt'
  const promptDescription = isModifyMode
    ? 'Describe the changes you want to apply to the existing module'
    : 'Describe what you want the module to do'
  const generateLabel = isModifyMode ? 'Generate Update Patch' : 'Generate Patch'

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Module Development"
        pageDescription="Develop AI modules using natural language prompts"
      >
        <div className="space-y-6">
          {/* Existing Modules List */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Modules</CardTitle>
              <CardDescription>
                View 6-step definitions for existing modules in the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Module</Label>
                <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                  <SelectTrigger className="w-[400px]">
                    <SelectValue placeholder="Select a module to view definition" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingModules ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading modules...
                      </div>
                    ) : aiModules.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No modules available in database
                      </div>
                    ) : (
                      aiModules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.name} ({module.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isLoadingDefinition && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading definition...</span>
                </div>
              )}

              {!isLoadingDefinition && selectedDefinition && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">6-Step Definition</h3>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([definitionMarkdown], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `module-${selectedModuleId}-definition.md`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }}
                    >
                      Download as Markdown
                    </Button>
                  </div>
                  <div className="rounded-md border bg-muted/50 p-4 overflow-auto max-h-[800px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {definitionMarkdown}
                    </pre>
                  </div>
                </div>
              )}

              {!isLoadingDefinition && !selectedDefinition && selectedModuleId && (
                <div className="text-center py-8 text-muted-foreground">
                  No definition found for this module. It may not have been created using the 6-step wizard.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              onClick={() => handleModeChange('create')}
            >
              Create New
            </Button>
            <Button
              variant={mode === 'modify' ? 'default' : 'outline'}
              onClick={() => handleModeChange('modify')}
            >
              Modify Existing
            </Button>
          </div>

          {mode === 'create' && !module && !showDefinitionWizard && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Module</CardTitle>
                <CardDescription>
                  Start by creating a new AI module (quick) or define one step-by-step
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleCreateModule}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Module (quick)
                </Button>
                <Button variant="outline" onClick={() => setShowDefinitionWizard(true)}>
                  Define new module (6 steps)
                </Button>
              </CardContent>
            </Card>
          )}

          {showDefinitionWizard && (
            <NewModuleDefinitionWizard
              onCancel={() => setShowDefinitionWizard(false)}
              onComplete={async (definitionState) => {
                setShowDefinitionWizard(false)
                setDefinitionFromWizard(definitionState)
                try {
                  const firstEntity =
                    definitionState.objectModel?.generated?.entities?.[0]?.identifier
                  const name =
                    firstEntity || definitionState.objectModel?.entities?.split(/[\n,]/)[0]?.trim() || `Module ${Date.now()}`
                  const newModule = await aiModulesApi.create({
                    name: name || `Module ${Date.now()}`,
                    description: 'Created from 6-step definition',
                  })
                  setModule(newModule)
                  setMode('create')
                  notification.success('Definition saved. Click "Generate module from definition" below to create the patch.')
                } catch {
                  notification.error('Failed to create module')
                }
              }}
            />
          )}

          {module && definitionFromWizard && (
            <Card>
              <CardHeader>
                <CardTitle>Definition summary (6 steps)</CardTitle>
                <CardDescription>
                  The JSON below is what was generated in the wizard. Use it to generate the actual module patch (Patch DSL).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="rounded-md border bg-muted/80 p-4 text-xs overflow-auto max-h-[280px] font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(buildDefinitionPayload(definitionFromWizard), null, 2)}
                </pre>
                <Button
                  onClick={handleGenerateFromDefinition}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate module from definition
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}


          {mode === 'modify' && (
            <Card>
              <CardHeader>
                <CardTitle>Select Existing Module</CardTitle>
                <CardDescription>
                  Choose a registered module to modify
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedRegistryId} onValueChange={setSelectedRegistryId}>
                  <SelectTrigger className="w-[320px]">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingRegistry ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading modules...
                      </div>
                    ) : registryModules.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No modules available
                      </div>
                    ) : (
                      registryModules.map((registryModule) => (
                        <SelectItem key={registryModule.id} value={registryModule.id}>
                          {registryModule.name} ({registryModule.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedRegistryModule && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedRegistryModule.name}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {canShowPrompt && (
            <Tabs defaultValue="prompt" className="space-y-4">
              <TabsList>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{promptTitle}</CardTitle>
                    <CardDescription>
                      {promptDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prompt">Prompt</Label>
                      <Textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Add a 'priority' field to the Customer entity with options: low, medium, high"
                        rows={6}
                      />
                    </div>
                    <Button
                      onClick={isModifyMode ? handleModifyPatch : handleGeneratePatch}
                      disabled={isGenerating || !prompt.trim()}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {generateLabel}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{isModifyMode ? 'Generated Update Patch' : 'Generated Patch'}</CardTitle>
                    <CardDescription>
                      Review and edit the generated Patch DSL
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {patchPreview ? (
                      <pre className="rounded-md bg-muted p-4 overflow-auto max-h-[600px]">
                        <code>{patchPreview}</code>
                      </pre>
                    ) : (
                      <p className="text-muted-foreground">
                        No patch generated yet. Generate a patch from the Prompt tab.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
