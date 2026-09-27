'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Workflow } from 'lucide-react'
import {
  blueprintsApi,
  BlueprintSummary,
  SemanticDeclaration,
  SemanticEntity,
} from '@/lib/api/blueprints.api'
import { WorkflowDefinitionEditor } from './components/workflow-definition-editor'
import { WorkflowStateDiagram } from './components/workflow-state-diagram'
import { WorkflowInstanceList } from './components/workflow-instance-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/core/store'
import { useTranslation } from '@/i18n'

export default function WorkflowsPage() {
  const t = useTranslation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [packages, setPackages] = useState<BlueprintSummary[]>([])
  const [semantic, setSemantic] = useState<SemanticDeclaration | null>(null)
  const [packageId, setPackageId] = useState('')
  const [entityName, setEntityName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    loadPackages()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 登录后拉一次包列表
  }, [isAuthenticated])

  useEffect(() => {
    if (!packageId) {
      setSemantic(null)
      setEntityName('')
      return
    }
    loadSemantic(packageId)
  }, [packageId])

  const loadPackages = async () => {
    try {
      setLoading(true)
      const data = await blueprintsApi.listBlueprints()
      setPackages(data)
      if (data.length > 0 && !packageId) {
        setPackageId(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load blueprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSemantic = async (id: string) => {
    try {
      const declared = await blueprintsApi.getSemantic(id)
      setSemantic(declared)
      const preferred =
        declared.entities.find((item) => item.states.length > 0) ?? declared.entities[0]
      setEntityName(preferred?.name ?? '')
    } catch (error) {
      console.error('Failed to load semantic:', error)
      setSemantic(null)
      setEntityName('')
    }
  }

  const selectedEntity: SemanticEntity | undefined = semantic?.entities.find(
    (item) => item.name === entityName,
  )
  const selectedPackage = packages.find((item) => item.id === packageId)

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('workflows.loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('workflows.title')}</h1>
        <p className="text-muted-foreground">{t('workflows.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t('workflows.guidance')}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">{t('workflows.selectPackage')}</div>
          <Select value={packageId || undefined} onValueChange={setPackageId}>
            <SelectTrigger>
              <SelectValue placeholder={t('workflows.selectPackageHint')} />
            </SelectTrigger>
            <SelectContent>
              {packages.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.manifest?.blueprint ?? item.id}
                  {item.manifest?.version ? ` @ ${item.manifest.version}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">{t('workflows.selectEntity')}</div>
          <Select value={entityName || undefined} onValueChange={setEntityName} disabled={!semantic}>
            <SelectTrigger>
              <SelectValue placeholder={t('workflows.selectEntityHint')} />
            </SelectTrigger>
            <SelectContent>
              {(semantic?.entities ?? []).map((item) => (
                <SelectItem key={item.name} value={item.name}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {packages.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">{t('workflows.noPackages')}</p>
          </CardContent>
        </Card>
      )}

      {selectedPackage && semantic && !selectedEntity && (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">{t('workflows.noEntities')}</p>
          </CardContent>
        </Card>
      )}

      {selectedEntity && (
        <Tabs defaultValue="definitions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="definitions">{t('workflows.definitions')}</TabsTrigger>
            <TabsTrigger value="instances">{t('workflows.instances')}</TabsTrigger>
          </TabsList>

          <TabsContent value="definitions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  {selectedEntity.name}
                </CardTitle>
                <CardDescription>
                  {selectedPackage?.manifest?.blueprint} @ {selectedPackage?.manifest?.version}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowDefinitionEditor entity={selectedEntity} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('workflows.stateDiagram')}</CardTitle>
                <CardDescription>{t('workflows.stateDiagramHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowStateDiagram entity={selectedEntity} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instances">
            <WorkflowInstanceList
              packageId={packageId}
              entity={selectedEntity.name}
              semantic={selectedEntity}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
