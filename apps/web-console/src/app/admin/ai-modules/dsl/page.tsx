'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileJson, Loader2, Search } from 'lucide-react'

import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import { Input } from '@sap/app-shared/components/ui/input'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import {
  aiModulesApi,
  type AIModuleDslBundle,
  type AIModuleDslSummary,
} from '@sap/app-shared/lib/api/ai-modules.api'

const STEP_LABELS: Array<[string, string]> = [
  ['step1_objectModel', 'Step 1 · Object model'],
  ['step2_relationships', 'Step 2 · Relationships'],
  ['step3_stateFlow', 'Step 3 · State flow'],
  ['step4_pages', 'Step 4 · Pages'],
  ['step5_permissions', 'Step 5 · Permissions'],
  ['step6_reports', 'Step 6 · Reports'],
]

function pretty(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

export default function ModuleDslPage() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<AIModuleDslSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bundle, setBundle] = useState<AIModuleDslBundle | null>(null)
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [exporting, setExporting] = useState(false)
  const notification = useNotification()

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await aiModulesApi.searchDsl({ search: search || undefined, limit: 50 })
      setItems(result.items)
      setTotal(result.total)
      setSelectedId((current) => current ?? result.items[0]?.id ?? null)
    } catch (error) {
      notification.error((error as Error).message || 'Failed to load DSL list')
    } finally {
      setLoading(false)
    }
  }, [notification, search])

  useEffect(() => {
    const timer = setTimeout(() => void loadList(), 250)
    return () => clearTimeout(timer)
  }, [loadList])

  useEffect(() => {
    let cancelled = false
    if (!selectedId) {
      setBundle(null)
      return
    }
    setLoadingBundle(true)
    aiModulesApi
      .getDsl(selectedId)
      .then((data) => {
        if (!cancelled) setBundle(data)
      })
      .catch((error) => {
        if (!cancelled) notification.error((error as Error).message || 'Failed to load DSL')
      })
      .finally(() => {
        if (!cancelled) setLoadingBundle(false)
      })
    return () => {
      cancelled = true
    }
  }, [notification, selectedId])

  const definitionSteps = useMemo(() => {
    if (!bundle?.definition) return []
    return STEP_LABELS.map(([key, label]) => ({ key, label, value: (bundle.definition as any)?.[key] }))
      .filter((step) => step.value !== undefined && step.value !== null)
  }, [bundle])

  const handleExport = async () => {
    if (!selectedId) return
    setExporting(true)
    try {
      const json = await aiModulesApi.exportDsl(selectedId)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${bundle?.module.name ?? 'module'}-dsl.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      notification.error((error as Error).message || 'Failed to export DSL')
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageContainer
      pageTitle='Module DSL'
      pageDescription='Browse saved Module DSL and the original 6-step definition. View-only; this page never generates code.'
      pageHeaderAction={
        <Button variant='outline' onClick={() => void handleExport()} disabled={!selectedId || exporting}>
          {exporting ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Download className='mr-2 h-4 w-4' />}
          Export JSON
        </Button>
      }
    >
      <div className='grid gap-4 lg:grid-cols-[320px_1fr]'>
        <Card className='h-fit'>
          <CardHeader>
            <CardTitle className='text-base'>Saved modules</CardTitle>
            <CardDescription>{total} module(s) with DSL</CardDescription>
            <div className='relative mt-2'>
              <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
              <Input
                className='pl-8'
                placeholder='Search name, description or DSL'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className='space-y-2'>
            {loading ? (
              <div className='text-muted-foreground flex items-center gap-2 py-6 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' /> Loading…
              </div>
            ) : items.length === 0 ? (
              <p className='text-muted-foreground py-6 text-sm'>No modules match.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedId === item.id
                      ? 'border-foreground/25 bg-accent'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='truncate text-sm font-medium'>{item.name}</span>
                    <Badge variant='outline'>{item.status}</Badge>
                  </div>
                  <div className='text-muted-foreground mt-1 flex items-center gap-2 text-xs'>
                    <span>v{item.version}</span>
                    <span>·</span>
                    <span>{item.dslKeys.length} key(s)</span>
                    {item.hasDefinition ? (
                      <>
                        <span>·</span>
                        <span>6-step</span>
                      </>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <FileJson className='h-4 w-4' />
              {bundle?.module.name ?? 'Select a module'}
            </CardTitle>
            <CardDescription>
              Patch DSL is stored in <code>ai_modules.patchContent</code>; the 6-step definition is stored in{' '}
              <code>ai_module_definitions</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBundle ? (
              <div className='text-muted-foreground flex items-center gap-2 py-10 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' /> Loading DSL…
              </div>
            ) : !bundle ? (
              <p className='text-muted-foreground py-10 text-sm'>Select a module to view its DSL.</p>
            ) : (
              <div className='space-y-6'>
                <section>
                  <h3 className='mb-2 text-sm font-semibold'>Module DSL (patchContent)</h3>
                  <pre className='bg-muted max-h-80 overflow-auto rounded-md border p-3 text-xs'>
                    {pretty(bundle.patchContent)}
                  </pre>
                </section>

                <section>
                  <h3 className='mb-2 text-sm font-semibold'>6-step definition</h3>
                  {definitionSteps.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      No 6-step definition found for this module.
                    </p>
                  ) : (
                    <div className='space-y-3'>
                      {definitionSteps.map((step) => (
                        <details key={step.key} className='rounded-md border'>
                          <summary className='cursor-pointer px-3 py-2 text-sm font-medium'>
                            {step.label}
                          </summary>
                          <pre className='bg-muted max-h-64 overflow-auto border-t p-3 text-xs'>
                            {pretty(step.value)}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
