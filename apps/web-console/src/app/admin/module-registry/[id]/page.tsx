'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'

import PageContainer from '@sap/app-shared/components/layout/page-container'
import { PermissionGuard } from '@sap/app-shared/core/auth/permission-guard'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { Textarea } from '@sap/app-shared/components/ui/textarea'
import {
  moduleRegistryApi,
  type ModuleCapability,
  type ModuleConfiguration,
  type ModuleHealth,
  type ModuleRegistry,
  type ModuleRelationship,
  type ModuleRelationshipGraph,
  type ModuleStatistics,
} from '@sap/api-client'

const RELATIONSHIP_TYPES = ['dependency', 'integration', 'data-flow', 'hierarchical']
const CONFIG_TYPES = ['schema', 'usage', 'api', 'relationship']

function parseJson(raw: string): Record<string, any> | null {
  if (!raw.trim()) return null
  return JSON.parse(raw)
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active' || status === 'healthy') return 'default'
  if (status === 'error') return 'destructive'
  if (status === 'warning') return 'secondary'
  return 'outline'
}

function RelationshipGraph({
  graph,
  currentId,
}: {
  graph: ModuleRelationshipGraph | null
  currentId: string
}) {
  const nodes = useMemo(() => (graph?.nodes ?? []).slice(0, 14), [graph])
  const positions = useMemo(() => {
    const center = { x: 260, y: 190 }
    const others = nodes.filter((node) => node.id !== currentId)
    const layout = new Map<string, { x: number; y: number }>()
    layout.set(currentId, center)
    const radius = 130
    others.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, others.length) - Math.PI / 2
      layout.set(node.id, {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      })
    })
    return layout
  }, [currentId, nodes])

  if (!graph || graph.nodes.length === 0) {
    return <p className='text-muted-foreground text-sm'>暂无关系图数据。</p>
  }

  return (
    <svg viewBox='0 0 520 380' className='bg-muted/30 h-80 w-full rounded border'>
      {graph.edges.map((edge) => {
        const from = positions.get(edge.source)
        const to = positions.get(edge.target)
        if (!from || !to) return null
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke='currentColor'
            strokeOpacity={0.35}
            strokeWidth={edge.type === 'dependency' ? 2 : 1}
            strokeDasharray={edge.type === 'data-flow' ? '4 4' : undefined}
          />
        )
      })}
      {nodes.map((node) => {
        const position = positions.get(node.id)
        if (!position) return null
        const current = node.id === currentId
        return (
          <g key={node.id}>
            <circle
              cx={position.x}
              cy={position.y}
              r={current ? 34 : 24}
              fill={current ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
              stroke='hsl(var(--border))'
            />
            <text
              x={position.x}
              y={position.y + (current ? 44 : 38)}
              textAnchor='middle'
              fontSize='10'
              fill='currentColor'
            >
              {node.name.length > 16 ? `${node.name.slice(0, 16)}…` : node.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ModuleRegistryDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const notification = useNotification()
  const [module, setModule] = useState<ModuleRegistry | null>(null)
  const [modules, setModules] = useState<ModuleRegistry[]>([])
  const [relationships, setRelationships] = useState<ModuleRelationship[]>([])
  const [statistics, setStatistics] = useState<ModuleStatistics[]>([])
  const [configurations, setConfigurations] = useState<ModuleConfiguration[]>([])
  const [health, setHealth] = useState<ModuleHealth | null>(null)
  const [graph, setGraph] = useState<ModuleRelationshipGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('active')
  const [relationshipDraft, setRelationshipDraft] = useState({
    targetModuleId: '',
    relationshipType: 'dependency',
    description: '',
  })
  const [configDraft, setConfigDraft] = useState({
    id: '',
    configType: 'schema',
    documentation: '',
    schema: '',
  })
  const [docs, setDocs] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [detail, rels, stats, configs, healthData, graphData, allModules] =
        await Promise.all([
          moduleRegistryApi.findOne(id),
          moduleRegistryApi.getRelationships(id),
          moduleRegistryApi.getStatistics(id),
          moduleRegistryApi.getConfigurations(id),
          moduleRegistryApi.getHealth(id),
          moduleRegistryApi.getGraph(),
          moduleRegistryApi.findAll(),
        ])
      setModule(detail)
      setStatus(detail.status)
      setRelationships(rels)
      setStatistics(stats)
      setConfigurations(configs)
      setHealth(healthData)
      setGraph(graphData)
      setModules(allModules.filter((item) => item.id !== id))
    } catch (error) {
      notification.error((error as Error).message || 'Failed to load module')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const saveStatus = async () => {
    setBusy(true)
    try {
      await moduleRegistryApi.updateStatus(id, status)
      notification.success('状态已更新')
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Status update failed')
    } finally {
      setBusy(false)
    }
  }

  const collectStats = async () => {
    setBusy(true)
    try {
      const rows = await moduleRegistryApi.collectStatistics(id)
      setStatistics(rows)
      notification.success(`已收集 ${rows.length} 个实体的统计`)
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Statistics collection failed')
    } finally {
      setBusy(false)
    }
  }

  const addRelationship = async () => {
    if (!relationshipDraft.targetModuleId) {
      notification.error('请选择目标模块')
      return
    }
    setBusy(true)
    try {
      await moduleRegistryApi.addRelationship(id, {
        targetModuleId: relationshipDraft.targetModuleId,
        relationshipType: relationshipDraft.relationshipType,
        description: relationshipDraft.description || undefined,
      })
      setRelationshipDraft({ targetModuleId: '', relationshipType: 'dependency', description: '' })
      notification.success('关系已添加')
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Add relationship failed')
    } finally {
      setBusy(false)
    }
  }

  const removeRelationship = async (relId: string) => {
    if (!window.confirm('删除这条关系？')) return
    setBusy(true)
    try {
      await moduleRegistryApi.removeRelationship(id, relId)
      notification.success('关系已删除')
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Remove relationship failed')
    } finally {
      setBusy(false)
    }
  }

  const saveConfiguration = async () => {
    setBusy(true)
    try {
      let schema: Record<string, any> | null = null
      try {
        schema = parseJson(configDraft.schema)
      } catch {
        notification.error('Schema 不是合法 JSON')
        return
      }
      if (configDraft.id) {
        await moduleRegistryApi.updateConfiguration(id, configDraft.id, {
          configType: configDraft.configType,
          documentation: configDraft.documentation,
          schema,
        })
      } else {
        await moduleRegistryApi.addConfiguration(
          id,
          configDraft.configType,
          schema ?? undefined,
          configDraft.documentation || undefined,
        )
      }
      setConfigDraft({ id: '', configType: 'schema', documentation: '', schema: '' })
      notification.success('配置已保存')
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Save configuration failed')
    } finally {
      setBusy(false)
    }
  }

  const editConfiguration = (configuration: ModuleConfiguration) => {
    setConfigDraft({
      id: configuration.id,
      configType: configuration.configType,
      documentation: configuration.documentation ?? '',
      schema: configuration.schema ? JSON.stringify(configuration.schema, null, 2) : '',
    })
  }

  const deleteConfiguration = async (configId: string) => {
    if (!window.confirm('删除这份配置文档？')) return
    setBusy(true)
    try {
      await moduleRegistryApi.deleteConfiguration(id, configId)
      notification.success('配置已删除')
      await load()
    } catch (error) {
      notification.error((error as Error).message || 'Delete configuration failed')
    } finally {
      setBusy(false)
    }
  }

  const generateDocs = async () => {
    setBusy(true)
    try {
      const result = await moduleRegistryApi.getDocumentation(id)
      setDocs(result.markdown)
    } catch (error) {
      notification.error((error as Error).message || 'Generate documentation failed')
    } finally {
      setBusy(false)
    }
  }

  const downloadDocs = () => {
    if (!docs) return
    const blob = new Blob([docs], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${module?.name ?? 'module'}-docs.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <PageContainer pageTitle='Module Registry'>
        <div className='text-muted-foreground flex items-center gap-2 py-10 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' /> Loading module…
        </div>
      </PageContainer>
    )
  }

  if (!module) {
    return (
      <PageContainer pageTitle='Module Registry'>
        <p className='text-muted-foreground py-10 text-sm'>Module not found.</p>
      </PageContainer>
    )
  }

  const capabilities: ModuleCapability[] = module.capabilities ?? []
  const healthyStats = statistics.filter((row) => row.healthStatus === 'healthy').length

  return (
    <PermissionGuard permission='system:manage'>
      <PageContainer
        pageTitle={module.name}
        pageDescription={module.description || 'Module registry detail'}
        pageHeaderAction={
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => void load()} disabled={busy}>
              <RefreshCw className='mr-2 h-4 w-4' /> Refresh
            </Button>
            <Button variant='outline' onClick={() => void generateDocs()} disabled={busy}>
              <Download className='mr-2 h-4 w-4' /> Docs
            </Button>
          </div>
        }
      >
        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
                {module.name}
                <Badge variant={statusVariant(module.status)}>{module.status}</Badge>
                <Badge variant='outline'>v{module.version}</Badge>
                <Badge variant='outline'>{module.moduleType}</Badge>
                {health ? (
                  <Badge variant={statusVariant(health.status)}>
                    health: {health.status}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                {module.metadata?.entities?.length
                  ? `实体：${module.metadata.entities.join(', ')}`
                  : '未声明实体'}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap items-end gap-3'>
              <div className='space-y-2'>
                <Label>状态</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className='w-40' aria-label='模块状态'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['active', 'inactive', 'deprecated', 'error'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void saveStatus()} disabled={busy}>
                保存状态
              </Button>
              <Button variant='outline' onClick={() => void collectStats()} disabled={busy}>
                收集统计
              </Button>
            </CardContent>
          </Card>

          <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Capabilities</CardTitle>
                <CardDescription>{capabilities.length} 项能力</CardDescription>
              </CardHeader>
              <CardContent>
                {capabilities.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>暂无能力声明。</p>
                ) : (
                  <div className='space-y-2'>
                    {capabilities.map((capability) => (
                      <div key={capability.id} className='rounded-md border p-2 text-sm'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-medium'>{capability.entity ?? '-'}</span>
                          <Badge variant='outline'>{capability.capabilityType}</Badge>
                        </div>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          操作：{capability.operations.join(', ') || '-'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          端点：{capability.apiEndpoints.join(', ') || '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Health</CardTitle>
                <CardDescription>状态、能力、统计证据</CardDescription>
              </CardHeader>
              <CardContent>
                {!health ? (
                  <p className='text-muted-foreground text-sm'>暂无健康数据。</p>
                ) : (
                  <div className='space-y-2'>
                    {health.checks.map((check) => (
                      <div key={check.name} className='flex items-start justify-between gap-3 text-sm'>
                        <div>
                          <div className='font-medium'>{check.name}</div>
                          <div className='text-muted-foreground text-xs'>{check.detail}</div>
                        </div>
                        <Badge variant={statusVariant(check.status)}>{check.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Relationships</CardTitle>
              <CardDescription>
                {graph?.summary
                  ? `${graph.summary.edges} 条边；依赖 ${graph.summary.dependencies}，集成 ${graph.summary.integrations}，数据流 ${graph.summary.dataFlows}`
                  : '模块关系'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <RelationshipGraph graph={graph} currentId={id} />
              <div className='flex flex-wrap items-end gap-2'>
                <div className='space-y-1'>
                  <Label>目标模块</Label>
                  <Select
                    aria-label='目标模块'
                    value={relationshipDraft.targetModuleId}
                    onValueChange={(value) =>
                      setRelationshipDraft((prev) => ({ ...prev, targetModuleId: value }))
                    }
                  >
                    <SelectTrigger className='w-56' aria-label='目标模块'>
                      <SelectValue placeholder='选择模块' />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>类型</Label>
                  <Select
                    aria-label='关系类型'
                    value={relationshipDraft.relationshipType}
                    onValueChange={(value) =>
                      setRelationshipDraft((prev) => ({ ...prev, relationshipType: value }))
                    }
                  >
                    <SelectTrigger className='w-40' aria-label='关系类型'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='min-w-48 flex-1 space-y-1'>
                  <Label>说明</Label>
                  <Input
                    value={relationshipDraft.description}
                    onChange={(event) =>
                      setRelationshipDraft((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <Button onClick={() => void addRelationship()} disabled={busy}>
                  <Plus className='mr-1 h-4 w-4' /> 添加
                </Button>
              </div>
              {relationships.length === 0 ? (
                <p className='text-muted-foreground text-sm'>暂无关系。</p>
              ) : (
                <div className='space-y-2'>
                  {relationships.map((relationship) => {
                    const outgoing = relationship.sourceModuleId === id
                    return (
                      <div
                        key={relationship.id}
                        className='flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm'
                      >
                        <span>
                          <Badge variant='outline'>{relationship.relationshipType}</Badge>{' '}
                          {outgoing
                            ? `→ ${relationship.targetModuleId}`
                            : `← ${relationship.sourceModuleId}`}
                          {relationship.description ? ` · ${relationship.description}` : ''}
                        </span>
                        <Button
                          size='sm'
                          variant='ghost'
                          aria-label='删除关系'
                          onClick={() => void removeRelationship(relationship.id)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Statistics</CardTitle>
              <CardDescription>
                {statistics.length} 个实体；healthy {healthyStats}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {statistics.length === 0 ? (
                <p className='text-muted-foreground text-sm'>尚未收集统计。</p>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b text-left'>
                        <th className='px-2 py-1'>Entity</th>
                        <th className='px-2 py-1'>Records</th>
                        <th className='px-2 py-1'>Errors</th>
                        <th className='px-2 py-1'>Avg ms</th>
                        <th className='px-2 py-1'>Health</th>
                        <th className='px-2 py-1'>Collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.map((row) => (
                        <tr key={row.id} className='border-b last:border-0'>
                          <td className='px-2 py-1'>{row.entity ?? '-'}</td>
                          <td className='px-2 py-1'>{row.recordCount}</td>
                          <td className='px-2 py-1'>{row.errorCount}</td>
                          <td className='px-2 py-1'>{row.averageResponseTime ?? '-'}</td>
                          <td className='px-2 py-1'>
                            <Badge variant={statusVariant(row.healthStatus)}>
                              {row.healthStatus}
                            </Badge>
                          </td>
                          <td className='px-2 py-1 text-xs text-muted-foreground'>
                            {row.collectedAt ? new Date(row.collectedAt).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Configuration documentation</CardTitle>
              <CardDescription>
                结构化 schema + 使用/API/关系说明；用于模块复用与 AI 上下文。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                {configurations.map((configuration) => (
                  <div
                    key={configuration.id}
                    className='flex items-center gap-2 rounded border px-2 py-1 text-sm'
                  >
                    <Badge variant='outline'>{configuration.configType}</Badge>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => editConfiguration(configuration)}
                    >
                      编辑
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      aria-label='删除配置'
                      onClick={() => void deleteConfiguration(configuration.id)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
              <div className='grid gap-2 md:grid-cols-[180px_1fr]'>
                <div className='space-y-1'>
                  <Label>类型</Label>
                  <Select
                    aria-label='配置类型'
                    value={configDraft.configType}
                    onValueChange={(value) =>
                      setConfigDraft((prev) => ({ ...prev, configType: value }))
                    }
                  >
                    <SelectTrigger aria-label='配置类型'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONFIG_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>说明 / 使用文档</Label>
                  <Textarea
                    rows={2}
                    value={configDraft.documentation}
                    onChange={(event) =>
                      setConfigDraft((prev) => ({ ...prev, documentation: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className='space-y-1'>
                <Label>Schema JSON（可选）</Label>
                <Textarea
                  rows={5}
                  className='font-mono text-xs'
                  value={configDraft.schema}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({ ...prev, schema: event.target.value }))
                  }
                  placeholder='{"fields":[...]}'
                />
              </div>
              <div className='flex gap-2'>
                <Button onClick={() => void saveConfiguration()} disabled={busy}>
                  {configDraft.id ? '更新配置' : '新增配置'}
                </Button>
                {configDraft.id ? (
                  <Button
                    variant='outline'
                    onClick={() =>
                      setConfigDraft({ id: '', configType: 'schema', documentation: '', schema: '' })
                    }
                  >
                    取消编辑
                  </Button>
                ) : null}
              </div>
              {docs ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>生成文档</span>
                    <Button size='sm' variant='outline' onClick={downloadDocs}>
                      <Download className='mr-1 h-4 w-4' /> 下载 .md
                    </Button>
                  </div>
                  <pre className='bg-muted max-h-96 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap'>
                    {docs}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
