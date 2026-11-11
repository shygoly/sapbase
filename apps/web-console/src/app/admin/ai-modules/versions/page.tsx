'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'

import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import {
  aiModulesApi,
  type AIModule,
  type AIModuleVersion,
  type AIModuleVersionDiff,
} from '@sap/api-client'

function pretty(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

export default function AIModuleVersionsPage() {
  const [modules, setModules] = useState<AIModule[]>([])
  const [moduleId, setModuleId] = useState('')
  const [versions, setVersions] = useState<AIModuleVersion[]>([])
  const [selected, setSelected] = useState<AIModuleVersion | null>(null)
  const [diff, setDiff] = useState<AIModuleVersionDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const notification = useNotification()

  useEffect(() => {
    aiModulesApi
      .findAll()
      .then((items) => {
        setModules(items)
        if (items[0]) setModuleId(items[0].id)
      })
      .catch((error) => notification.error((error as Error).message || 'Failed to load modules'))
  }, [notification])

  const loadVersions = useCallback(async () => {
    if (!moduleId) return
    setLoading(true)
    try {
      const page = await aiModulesApi.listVersions(moduleId, { pageSize: 50 })
      setVersions(page.items)
      setSelected(page.items[0] ?? null)
      setDiff(null)
    } catch (error) {
      notification.error((error as Error).message || 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }, [moduleId, notification])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions])

  const compareWithPrevious = async (version: AIModuleVersion) => {
    const index = versions.findIndex((item) => item.id === version.id)
    const previous = versions[index + 1]
    if (!previous) return
    try {
      setDiff(await aiModulesApi.diffVersions(moduleId, previous.id, version.id))
    } catch (error) {
      notification.error((error as Error).message || 'Failed to diff versions')
    }
  }

  const rollback = async (version: AIModuleVersion) => {
    if (!window.confirm(`回滚到 ${version.version}（${version.id.slice(0, 8)}）？状态会回到 draft。`)) {
      return
    }
    setBusy(true)
    try {
      await aiModulesApi.rollbackVersion(moduleId, version.id)
      notification.success('已回滚；请重新测试并提交评审')
      await loadVersions()
    } catch (error) {
      notification.error((error as Error).message || 'Rollback failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer
      pageTitle='AI Module Versions'
      pageDescription='版本快照、变更 diff 与回滚。每次生成/修改/评审/发布都会留痕。'
      pageHeaderAction={
        <Button variant='outline' onClick={() => void loadVersions()} disabled={loading}>
          {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
          Refresh
        </Button>
      }
    >
      <div className='space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Select module</CardTitle>
            <CardDescription>按模块查看版本历史（最新在前）。</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger className='w-full max-w-md'>
                <SelectValue placeholder='Select a module' />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name} · v{module.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>History</CardTitle>
              <CardDescription>{versions.length} snapshot(s)</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {loading ? (
                <div className='text-muted-foreground flex items-center gap-2 py-6 text-sm'>
                  <Loader2 className='h-4 w-4 animate-spin' /> Loading…
                </div>
              ) : versions.length === 0 ? (
                <p className='text-muted-foreground py-6 text-sm'>No versions yet.</p>
              ) : (
                versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`space-y-2 rounded-md border p-3 ${
                      selected?.id === version.id ? 'border-foreground/25 bg-accent/40' : ''
                    }`}
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      <button
                        type='button'
                        className='font-medium hover:underline'
                        onClick={() => setSelected(version)}
                      >
                        v{version.version}
                      </button>
                      <Badge variant='outline'>{version.status}</Badge>
                      <Badge variant='secondary'>{version.reason ?? 'snapshot'}</Badge>
                      <span className='text-muted-foreground text-xs'>
                        {version.actor} · {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button size='sm' variant='outline' onClick={() => setSelected(version)}>
                        View JSON
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={index === versions.length - 1}
                        onClick={() => void compareWithPrevious(version)}
                      >
                        Diff previous
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={busy}
                        onClick={() => void rollback(version)}
                      >
                        <RotateCcw className='mr-1 h-4 w-4' /> Rollback
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{diff ? 'Diff' : 'Snapshot'}</CardTitle>
              <CardDescription>
                {diff
                  ? `v${diff.from.version} → v${diff.to.version}，${diff.changes.length} 处变更`
                  : selected
                    ? `v${selected.version} · ${selected.reason ?? 'snapshot'}`
                    : 'Select a version'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diff ? (
                <div className='space-y-2'>
                  {diff.changes.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>No changes.</p>
                  ) : (
                    diff.changes.map((change) => (
                      <div key={change.path} className='rounded border p-2 font-mono text-xs'>
                        <div className='font-semibold'>{change.path}</div>
                        <div className='text-destructive'>- {pretty(change.from)}</div>
                        <div className='text-success'>+ {pretty(change.to)}</div>
                      </div>
                    ))
                  )}
                </div>
              ) : !selected ? (
                <p className='text-muted-foreground py-8 text-sm'>Select a version.</p>
              ) : (
                <pre className='bg-muted max-h-[32rem] overflow-auto rounded-md border p-3 text-xs'>
                  {pretty({
                    version: selected.version,
                    status: selected.status,
                    actor: selected.actor,
                    reason: selected.reason,
                    patchContent: selected.patchContent,
                    metadata: selected.metadata,
                  })}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
