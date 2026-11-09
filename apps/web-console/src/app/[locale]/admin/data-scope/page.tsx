/**
 * Data Scope Management
 *
 * 一个页面覆盖：维度 → 节点 → 成员 → 绑定 → 策略 → 预览/预检。
 * 判定全部在服务端；这里只做输入与展示，不在客户端存权限真相。
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  dataScopeApi,
  type DataPolicy,
  type ScopeBinding,
  type ScopeDimension,
  type ScopeMembership,
  type ScopeNode,
  type ScopePreview,
} from '@sap/app-shared/lib/api'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sap/app-shared/components/ui/tabs'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'

const pageModel: PageModel = {
  id: 'data-scope-page',
  title: 'Data Scope',
  description: '维度 / 节点 / 成员 / 绑定 / 策略 / 有效范围预览',
  permissions: ['data-scope:read'],
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function DataScopePage() {
  const notification = useNotification()
  const [dimensions, setDimensions] = useState<ScopeDimension[]>([])
  const [nodes, setNodes] = useState<ScopeNode[]>([])
  const [memberships, setMemberships] = useState<ScopeMembership[]>([])
  const [bindings, setBindings] = useState<ScopeBinding[]>([])
  const [policies, setPolicies] = useState<DataPolicy[]>([])
  const [selectedDimension, setSelectedDimension] = useState('')
  const [preview, setPreview] = useState<ScopePreview | null>(null)
  const [preflight, setPreflight] = useState<{ total: number; missing: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const dimensionName = useMemo(
    () => new Map(dimensions.map((dimension) => [dimension.id, dimension.key])),
    [dimensions],
  )

  async function refreshDimensions() {
    setDimensions(await dataScopeApi.listDimensions())
  }

  async function refreshNodes(dimensionId = selectedDimension) {
    setNodes(await dataScopeApi.listNodes(dimensionId || undefined))
  }

  async function refreshMemberships(nodeId?: string) {
    setMemberships(await dataScopeApi.listMemberships(nodeId))
  }

  async function refreshBindings(resourceKey?: string) {
    setBindings(await dataScopeApi.listBindings(resourceKey))
  }

  async function refreshPolicies(resourceKey?: string) {
    setPolicies(await dataScopeApi.listPolicies(resourceKey))
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        await Promise.all([
          refreshDimensions(),
          refreshNodes(''),
          refreshMemberships(),
          refreshBindings(),
          refreshPolicies(),
        ])
      } catch (error) {
        notification.error(`加载数据范围失败：${errorMessage(error)}`)
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action()
      notification.success(success)
    } catch (error) {
      notification.error(errorMessage(error))
    }
  }

  return (
    <PageRuntime model={pageModel} isLoading={loading}>
      <Tabs defaultValue="dimensions" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="dimensions">维度</TabsTrigger>
          <TabsTrigger value="nodes">节点</TabsTrigger>
          <TabsTrigger value="memberships">成员</TabsTrigger>
          <TabsTrigger value="bindings">绑定</TabsTrigger>
          <TabsTrigger value="policies">策略</TabsTrigger>
          <TabsTrigger value="preview">预览/预检</TabsTrigger>
        </TabsList>

        <TabsContent value="dimensions">
          <Card>
            <CardHeader>
              <CardTitle>范围维度</CardTitle>
              <CardDescription>
                行业词只作为配置值（如 region / campus / class），平台表结构不写死。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const key = String(form.get('key') ?? '').trim()
                  const name = String(form.get('name') ?? '').trim()
                  if (!key || !name) return
                  void run(async () => {
                    await dataScopeApi.createDimension({ key, name })
                    await refreshDimensions()
                  }, '维度已创建')
                  event.currentTarget.reset()
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="dimension-key">Key</Label>
                  <Input id="dimension-key" name="key" placeholder="region" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimension-name">名称</Label>
                  <Input id="dimension-name" name="name" placeholder="区域" required />
                </div>
                <Button type="submit">创建维度</Button>
              </form>

              <div className="divide-y rounded-lg border">
                {dimensions.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">还没有维度。</p>
                )}
                {dimensions.map((dimension) => (
                  <div key={dimension.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{dimension.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dimension.key} · {dimension.status}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          await dataScopeApi.deleteDimension(dimension.id)
                          await refreshDimensions()
                          if (selectedDimension === dimension.id) {
                            setSelectedDimension('')
                            setNodes([])
                          }
                        }, '维度已删除')
                      }
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes">
          <Card>
            <CardHeader>
              <CardTitle>范围节点</CardTitle>
              <CardDescription>
                物化路径 `/a/b/c`；跨维度父节点会被服务端拒绝。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="node-dimension">维度</Label>
                  <select
                    id="node-dimension"
                    className="h-10 rounded-lg border border-input px-3 text-sm"
                    value={selectedDimension}
                    onChange={(event) => {
                      setSelectedDimension(event.target.value)
                      void refreshNodes(event.target.value)
                    }}
                  >
                    <option value="">全部</option>
                    {dimensions.map((dimension) => (
                      <option key={dimension.id} value={dimension.id}>
                        {dimension.key}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const dimensionId = String(form.get('dimensionId') ?? '')
                  const parentId = String(form.get('parentId') ?? '').trim()
                  const name = String(form.get('name') ?? '').trim()
                  if (!dimensionId || !name) return
                  void run(async () => {
                    await dataScopeApi.createNode({
                      dimensionId,
                      parentId: parentId || null,
                      name,
                    })
                    await refreshNodes(dimensionId)
                  }, '节点已创建')
                  event.currentTarget.reset()
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="node-dimension-id">维度</Label>
                  <select
                    id="node-dimension-id"
                    name="dimensionId"
                    className="h-10 rounded-lg border border-input px-3 text-sm"
                    required
                    defaultValue={selectedDimension}
                  >
                    <option value="">选择维度</option>
                    {dimensions.map((dimension) => (
                      <option key={dimension.id} value={dimension.id}>
                        {dimension.key}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="node-parent">父节点 ID（可选）</Label>
                  <Input id="node-parent" name="parentId" placeholder="uuid" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="node-name">名称</Label>
                  <Input id="node-name" name="name" placeholder="江苏" required />
                </div>
                <Button type="submit">创建节点</Button>
              </form>

              <div className="divide-y rounded-lg border">
                {nodes.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">还没有节点。</p>
                )}
                {nodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">
                        {node.name}{' '}
                        <span className="text-xs text-muted-foreground">
                          {dimensionName.get(node.dimensionId) ?? node.dimensionId}
                        </span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{node.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const parentId = window.prompt('新父节点 ID（留空 = 根节点）')
                          if (parentId === null) return
                          void run(async () => {
                            await dataScopeApi.moveNode(node.id, parentId.trim() || null)
                            await refreshNodes()
                          }, '节点已移动')
                        }}
                      >
                        移动
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void run(async () => {
                            await dataScopeApi.deleteNode(node.id)
                            await refreshNodes()
                          }, '节点已删除')
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memberships">
          <Card>
            <CardHeader>
              <CardTitle>范围成员</CardTitle>
              <CardDescription>
                主体（用户/角色/组）→ 节点 + 岗位 + 有效期；过期关系不参与解析。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const nodeId = String(form.get('nodeId') ?? '').trim()
                  const subjectType = String(form.get('subjectType') ?? 'user') as
                    | 'user'
                    | 'role'
                    | 'group'
                  const subjectId = String(form.get('subjectId') ?? '').trim()
                  const positionKey = String(form.get('positionKey') ?? '').trim()
                  if (!nodeId || !subjectId || !positionKey) return
                  void run(async () => {
                    await dataScopeApi.createMembership({
                      nodeId,
                      subjectType,
                      subjectId,
                      positionKey,
                      validFrom: String(form.get('validFrom') ?? '') || null,
                      validTo: String(form.get('validTo') ?? '') || null,
                    })
                    await refreshMemberships()
                  }, '成员关系已创建')
                  event.currentTarget.reset()
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="membership-node">节点 ID</Label>
                  <Input id="membership-node" name="nodeId" placeholder="uuid" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="membership-subject-type">主体类型</Label>
                  <select
                    id="membership-subject-type"
                    name="subjectType"
                    className="h-10 w-full rounded-lg border border-input px-3 text-sm"
                  >
                    <option value="user">user</option>
                    <option value="role">role</option>
                    <option value="group">group</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="membership-subject">主体 ID</Label>
                  <Input id="membership-subject" name="subjectId" placeholder="userId / roleKey" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="membership-position">岗位</Label>
                  <Input id="membership-position" name="positionKey" placeholder="province_manager" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="membership-from">生效时间（可选）</Label>
                  <Input id="membership-from" name="validFrom" type="datetime-local" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="membership-to">失效时间（可选）</Label>
                  <Input id="membership-to" name="validTo" type="datetime-local" />
                </div>
                <div className="flex items-end">
                  <Button type="submit">创建成员关系</Button>
                </div>
              </form>

              <div className="divide-y rounded-lg border">
                {memberships.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">还没有成员关系。</p>
                )}
                {memberships.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">
                        {membership.subjectType}:{membership.subjectId} → {membership.positionKey}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        node {membership.nodeId} · {membership.validFrom ?? '∞'} ~{' '}
                        {membership.validTo ?? '∞'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          await dataScopeApi.deleteMembership(membership.id)
                          await refreshMemberships()
                        }, '成员关系已删除')
                      }
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bindings">
          <Card>
            <CardHeader>
              <CardTitle>资源绑定</CardTitle>
              <CardDescription>
                资源键带命名空间：`platform:*` 落到列，`blueprint:*` / `app:*` 落到 JSONB。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const resourceKey = String(form.get('resourceKey') ?? '').trim()
                  const dimensionKey = String(form.get('dimensionKey') ?? '').trim()
                  const kind = String(form.get('kind') ?? 'field') as
                    | 'field'
                    | 'owner'
                    | 'relation'
                  const field = String(form.get('field') ?? '').trim()
                  if (!resourceKey || !dimensionKey) return
                  void run(async () => {
                    await dataScopeApi.createBinding({
                      resourceKey,
                      dimensionKey,
                      kind,
                      field: field || null,
                    })
                    await refreshBindings()
                  }, '绑定已创建')
                  event.currentTarget.reset()
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="binding-resource">资源键</Label>
                  <Input id="binding-resource" name="resourceKey" placeholder="platform:crm_customers" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="binding-dimension">维度 key</Label>
                  <Input id="binding-dimension" name="dimensionKey" placeholder="region" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="binding-kind">绑定方式</Label>
                  <select
                    id="binding-kind"
                    name="kind"
                    className="h-10 w-full rounded-lg border border-input px-3 text-sm"
                  >
                    <option value="field">field</option>
                    <option value="owner">owner</option>
                    <option value="relation">relation</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="binding-field">字段</Label>
                  <Input id="binding-field" name="field" placeholder="regionId" />
                </div>
                <div className="flex items-end">
                  <Button type="submit">创建绑定</Button>
                </div>
              </form>

              <div className="divide-y rounded-lg border">
                {bindings.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">还没有绑定。</p>
                )}
                {bindings.map((binding) => (
                  <div key={binding.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">
                        {binding.resourceKey} → {binding.dimensionKey} ({binding.kind})
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {binding.field ?? (binding.relation ? JSON.stringify(binding.relation) : '-')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          await dataScopeApi.deleteBinding(binding.id)
                          await refreshBindings()
                        }, '绑定已删除')
                      }
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>数据策略</CardTitle>
              <CardDescription>
                allow 并集、deny 覆盖；蓝图模板 cap 与租户策略取交集，租户不能放大。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const name = String(form.get('name') ?? '').trim()
                  const resourceKey = String(form.get('resourceKey') ?? '').trim()
                  const subject = String(form.get('subject') ?? '').trim()
                  const actions = String(form.get('actions') ?? '')
                    .split(',')
                    .map((action) => action.trim())
                    .filter(Boolean)
                  const scope = String(form.get('scope') ?? '').trim()
                  if (!name || !resourceKey || !subject || !scope) return
                  void run(async () => {
                    await dataScopeApi.createPolicy({
                      name,
                      resourceKey,
                      subject: JSON.parse(subject) as Record<string, unknown>,
                      actions,
                      effect: String(form.get('effect') ?? 'allow') as 'allow' | 'deny',
                      scope: JSON.parse(scope) as Record<string, unknown>,
                      priority: Number(form.get('priority') ?? 0),
                    })
                    await refreshPolicies()
                  }, '策略已创建')
                  event.currentTarget.reset()
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="policy-name">名称</Label>
                  <Input id="policy-name" name="name" placeholder="省经理子树" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="policy-resource">资源键</Label>
                  <Input id="policy-resource" name="resourceKey" placeholder="platform:crm_customers" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="policy-subject">主体 JSON</Label>
                  <Input
                    id="policy-subject"
                    name="subject"
                    placeholder='{"kind":"role","roleKey":"province_manager"}'
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="policy-actions">动作（逗号分隔）</Label>
                  <Input id="policy-actions" name="actions" defaultValue="read,list" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="policy-scope">范围 JSON</Label>
                  <textarea
                    id="policy-scope"
                    name="scope"
                    rows={4}
                    className="w-full rounded-lg border border-input px-3 py-2 font-mono text-xs"
                    defaultValue={
                      '{"kind":"node","dimension":"region","anchor":"membership","positions":["province_manager"],"depth":"subtree"}'
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="policy-effect">效果</Label>
                    <select
                      id="policy-effect"
                      name="effect"
                      className="h-10 w-full rounded-lg border border-input px-3 text-sm"
                    >
                      <option value="allow">allow</option>
                      <option value="deny">deny</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="policy-priority">优先级</Label>
                    <Input id="policy-priority" name="priority" type="number" defaultValue={0} />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button type="submit">创建策略</Button>
                </div>
              </form>

              <div className="divide-y rounded-lg border">
                {policies.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">还没有策略。</p>
                )}
                {policies.map((policy) => (
                  <div key={policy.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {policy.name}{' '}
                        <span className="text-xs text-muted-foreground">
                          {policy.effect} · {policy.resourceKey}
                        </span>
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {JSON.stringify(policy.subject)} · {policy.actions.join(',')} ·{' '}
                        {JSON.stringify(policy.scope)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          await dataScopeApi.deletePolicy(policy.id)
                          await refreshPolicies()
                        }, '策略已删除')
                      }
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>有效范围预览</CardTitle>
                <CardDescription>
                  以当前登录用户 + 资源键 + 动作解析；只返回谓词/版本，不返回业务行。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    const resourceKey = String(form.get('resourceKey') ?? '').trim()
                    const action = String(form.get('action') ?? 'read').trim()
                    if (!resourceKey) return
                    void run(async () => {
                      setPreview(await dataScopeApi.preview({ resourceKey, action }))
                    }, '预览已刷新')
                    event.currentTarget.reset()
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor="preview-resource">资源键</Label>
                    <Input id="preview-resource" name="resourceKey" placeholder="platform:crm_customers" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="preview-action">动作</Label>
                    <Input id="preview-action" name="action" defaultValue="read" />
                  </div>
                  <Button type="submit">解析</Button>
                </form>
                {preview ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      version {preview.version} · declared {String(preview.declared)}
                    </p>
                    <JsonBlock value={preview.expr} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚未解析。</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>空绑定预检</CardTitle>
                <CardDescription>
                  启用 dataScope 前统计绑定字段为 null/空的行；这些行会被 fail-closed 隐藏。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    const packageId = String(form.get('packageId') ?? '').trim()
                    const entity = String(form.get('entity') ?? '').trim()
                    const field = String(form.get('field') ?? '').trim()
                    if (!packageId || !entity || !field) return
                    void run(async () => {
                      setPreflight(
                        await dataScopeApi.preflight({ packageId, entity, field }),
                      )
                    }, '预检完成')
                    event.currentTarget.reset()
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor="preflight-package">蓝图包 ID</Label>
                    <Input id="preflight-package" name="packageId" placeholder="education-1.0.0" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="preflight-entity">实体</Label>
                    <Input id="preflight-entity" name="entity" placeholder="Student" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="preflight-field">绑定字段</Label>
                    <Input id="preflight-field" name="field" placeholder="classId" required />
                  </div>
                  <Button type="submit">统计</Button>
                </form>
                {preflight ? (
                  <p className="text-sm">
                    总行数 {preflight.total} · 空绑定 {preflight.missing}
                    {preflight.missing > 0
                      ? '（启用前必须回填，否则这些行会被隐藏）'
                      : '（可以安全启用）'}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">尚未预检。</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageRuntime>
  )
}
