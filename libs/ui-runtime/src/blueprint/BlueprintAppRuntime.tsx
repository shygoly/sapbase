'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { blueprintsApi } from '@sap/api-client/api/blueprints.api'
import {
  canAccessBlueprintResource,
  type BlueprintPermissionsLayer,
} from '@sap/shared-core'
import { useAuthStore } from '@sap/shared-state'
import { Button } from '@sap/ui-kit/button'
import { Card, CardContent } from '@sap/ui-kit/card'
import { SchemaForm } from '../components/schema-form'
import { SchemaList } from '../components/schema-list'
import PageContainer from '../layout/page-container'
import type { FieldDefinition, ObjectSchema } from '../schema/types'

export interface BlueprintUiPage {
  identifier: string
  label?: string
  description?: string
  type: 'list' | 'form' | 'detail'
  entity: string
  route?: string
  fields?: string[]
}

export interface BlueprintUiMenu {
  identifier: string
  label: string
  path: string
  icon?: string
  order?: number
  permissions?: string[]
}

export interface BlueprintUiLayer {
  ui: 'blueprint-ui/v1' | string
  pages: BlueprintUiPage[]
  menus?: BlueprintUiMenu[]
}

export interface BlueprintEntityField {
  name: string
  type: string
  required?: boolean
  values?: string[]
  reference?: string
}

export interface BlueprintEntitySchema {
  name: string
  fields: BlueprintEntityField[]
}

interface BlueprintAppRuntimeProps {
  packageId: string
  pageId?: string
}

function fieldDefinitionOf(field: BlueprintEntityField): FieldDefinition {
  const type =
    field.type === 'boolean'
      ? 'checkbox'
      : field.type === 'date'
        ? 'date'
        : field.type === 'datetime'
          ? 'datetime'
          : field.type === 'number' || field.type === 'decimal' || field.type === 'i32'
            ? 'number'
            : field.type === 'enum'
              ? 'select'
              : 'text'
  return {
    name: field.name,
    label: field.name,
    type,
    required: field.required === true,
    options: field.values?.map((value) => ({ label: value, value })),
    relationObject: field.reference,
  }
}

function objectSchemaOf(entity: BlueprintEntitySchema): ObjectSchema {
  return {
    name: entity.name,
    label: entity.name,
    fields: entity.fields.map(fieldDefinitionOf),
    version: '1.0.0',
  }
}

/**
 * 通用 Blueprint 应用消费者：菜单 + list/form/detail。
 *
 * v1 只做“声明消费”：字段来自 compiled entities，记录走既有 blueprint records API。
 * 不生成静态路由；页面由 ui.json 的 identifier 决定。
 */
export function BlueprintAppRuntime({ packageId, pageId }: BlueprintAppRuntimeProps) {
  const user = useAuthStore((state) => state.user)
  const storePermissions = useAuthStore((state) => state.user?.permissions ?? [])
  const [ui, setUi] = useState<BlueprintUiLayer | null>(null)
  const [entities, setEntities] = useState<BlueprintEntitySchema[]>([])
  const [permissions, setPermissions] = useState<BlueprintPermissionsLayer | null>(null)
  const [activePageId, setActivePageId] = useState(pageId ?? '')
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([])
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const actor = useMemo(
    () => ({
      role: (user as { role?: string } | null)?.role ?? null,
      permissions: Array.isArray(storePermissions) ? storePermissions : [],
    }),
    [storePermissions, user],
  )

  const permittedPages = useMemo(() => {
    if (!ui) return []
    return ui.pages.filter((page) =>
      canAccessBlueprintResource(permissions, actor, page.entity, 'read'),
    )
  }, [actor, permissions, ui])

  const activePage =
    permittedPages.find((page) => page.identifier === activePageId) ?? permittedPages[0]

  const entity = entities.find((item) => item.name === activePage?.entity)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      blueprintsApi.getUi(packageId),
      blueprintsApi.getEntities(packageId),
      blueprintsApi.getPermissions(packageId).catch(() => null),
    ])
      .then(([uiLayer, entityList, permissionLayer]) => {
        if (!mounted) return
        setUi(uiLayer as BlueprintUiLayer)
        setEntities(entityList as BlueprintEntitySchema[])
        setPermissions((permissionLayer as BlueprintPermissionsLayer | null) ?? null)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!mounted) return
        setError(cause instanceof Error ? cause.message : 'Failed to load blueprint')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [packageId])

  useEffect(() => {
    if (!pageId) return
    setActivePageId(pageId)
  }, [pageId])

  const loadRecords = useCallback(async () => {
    if (!activePage || activePage.type !== 'list') return
    const page = await blueprintsApi.listRecords(packageId, activePage.entity, {
      page: 1,
      pageSize: 100,
    })
    setRecords(page.items.map((item) => item.data))
  }, [activePage, packageId])

  useEffect(() => {
    setSelected(null)
    void loadRecords().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Failed to load records')
    })
  }, [loadRecords])

  if (loading) {
    return <PageContainer pageTitle='Loading…'><div /></PageContainer>
  }
  if (error) {
    return (
      <PageContainer pageTitle='Blueprint app'>
        <div className='rounded-md border border-red-200 bg-red-50 p-4 text-red-700'>{error}</div>
      </PageContainer>
    )
  }
  if (!ui) {
    return (
      <PageContainer pageTitle='Blueprint app'>
        <div className='text-muted-foreground'>该包未发布 ui.json。</div>
      </PageContainer>
    )
  }
  if (!activePage) {
    return (
      <PageContainer pageTitle='Blueprint app'>
        <div className='text-muted-foreground'>当前角色没有可访问的页面。</div>
      </PageContainer>
    )
  }

  const schema = entity ? objectSchemaOf(entity) : null

  return (
    <PageContainer
      pageTitle={activePage.label ?? activePage.identifier}
      pageDescription={activePage.description}
    >
      <div className='space-y-5'>
        <div className='flex flex-wrap gap-2'>
          {permittedPages.map((page) => (
            <Button
              key={page.identifier}
              variant={page.identifier === activePage.identifier ? 'default' : 'outline'}
              size='sm'
              onClick={() => setActivePageId(page.identifier)}
            >
              {page.label ?? page.identifier}
            </Button>
          ))}
        </div>

        {ui.menus && ui.menus.length > 0 ? (
          <div className='flex flex-wrap gap-3 text-sm text-muted-foreground'>
            {ui.menus
              .filter(
                (menu) =>
                  !menu.permissions ||
                  menu.permissions.length === 0 ||
                  menu.permissions.some((permission) => actor.permissions.includes(permission)),
              )
              .map((menu) => (
                <span key={menu.identifier}>{menu.label}</span>
              ))}
          </div>
        ) : null}

        <Card>
          <CardContent className='pt-6'>
            {!schema ? (
              <div className='text-muted-foreground'>实体 {activePage.entity} 未在包内声明。</div>
            ) : activePage.type === 'list' ? (
              <SchemaList
                schema={schema}
                data={records}
                onRowClick={(row) => setSelected(row)}
              />
            ) : activePage.type === 'form' ? (
              <SchemaForm
                schema={schema}
                onSubmit={async (data) => {
                  await blueprintsApi.createRecord(packageId, activePage.entity, data)
                  await loadRecords()
                }}
              />
            ) : (
              <div className='space-y-3'>
                {selected ? (
                  <dl className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    {schema.fields.map((field) => (
                      <div key={field.name}>
                        <dt className='text-xs text-muted-foreground'>{field.label}</dt>
                        <dd className='text-sm'>{String(selected[field.name] ?? '—')}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className='text-muted-foreground'>先从列表选择一条记录。</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
