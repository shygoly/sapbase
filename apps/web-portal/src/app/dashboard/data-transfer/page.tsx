'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import {
  bulkApi,
  type BulkExportFormat,
  type BulkResource,
  type ExportRun,
  type ImportRun,
} from '@sap/api-client'

function statusVariant(status: string) {
  if (status === 'succeeded') return 'default' as const
  if (status === 'partial') return 'secondary' as const
  if (status === 'failed' || status === 'cancelled') return 'destructive' as const
  return 'outline' as const
}

async function waitImport(id: string): Promise<ImportRun> {
  for (let index = 0; index < 120; index += 1) {
    const run = await bulkApi.importRun(id)
    if (!['queued', 'running'].includes(run.status)) return run
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return bulkApi.importRun(id)
}

async function waitExport(id: string): Promise<ExportRun> {
  for (let index = 0; index < 180; index += 1) {
    const run = await bulkApi.exportRun(id)
    if (!['queued', 'running'].includes(run.status)) return run
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return bulkApi.exportRun(id)
}

export default function DataTransferPage() {
  const [resources, setResources] = useState<BulkResource[]>([])
  const [resourceKey, setResourceKey] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'partial' | 'atomic'>('partial')
  const [dryRun, setDryRun] = useState(false)
  const [mappingText, setMappingText] = useState('')
  const [imports, setImports] = useState<ImportRun[]>([])
  const [exports, setExports] = useState<ExportRun[]>([])
  const [format, setFormat] = useState<BulkExportFormat>('csv')
  const [fields, setFields] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [piiPolicy, setPiiPolicy] = useState<'allow' | 'mask'>('allow')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = useMemo(
    () => resources.find((item) => item.resourceKey === resourceKey),
    [resources, resourceKey],
  )

  const load = useCallback(async () => {
    try {
      const [resourceList, importRuns, exportRuns] = await Promise.all([
        bulkApi.resources(),
        bulkApi.imports(),
        bulkApi.exports(),
      ])
      setResources(resourceList)
      setImports(importRuns)
      setExports(exportRuns)
      setResourceKey((current) => current || resourceList[0]?.resourceKey || '')
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载导入/导出资源失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    setFields(selected.fields.filter((field) => field.exportable !== false).map((field) => field.key))
  }, [selected])

  const importNow = async () => {
    if (!file || !resourceKey) return
    setBusy(true)
    try {
      let mapping: Record<string, unknown> | undefined
      if (mappingText.trim()) {
        mapping = JSON.parse(mappingText) as Record<string, unknown>
      }
      const created = await bulkApi.createImport({
        resourceKey,
        file,
        mode,
        dryRun,
        mapping,
      })
      const finished = ['queued', 'running'].includes(created.run.status)
        ? await waitImport(created.run.id)
        : created.run
      setMessage(
        `导入 ${finished.status}：成功 ${finished.successCount} / 失败 ${finished.failureCount}`,
      )
      setFile(null)
      await load()
    } catch (error) {
      setMessage((error as Error).message || '导入失败')
    } finally {
      setBusy(false)
    }
  }

  const exportNow = async () => {
    if (!resourceKey) return
    setBusy(true)
    try {
      const created = await bulkApi.createExport({
        resourceKey,
        format,
        fields,
        search: search || undefined,
        piiPolicy,
      })
      const finished = await waitExport(created.run.id)
      setMessage(
        finished.status === 'succeeded'
          ? `导出完成：${finished.rowCount} 行`
          : `导出 ${finished.status}：${finished.error ?? ''}`,
      )
      await load()
    } catch (error) {
      setMessage((error as Error).message || '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer
      pageTitle='批量导入导出'
      pageDescription='模板 / 上传 / 列映射 / 部分成功 / 错误报告；筛选字段导出 CSV/XLSX/MD/PDF。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>资源</span>
            <Select value={resourceKey} onValueChange={setResourceKey}>
              <SelectTrigger className='w-80'>
                <SelectValue placeholder='选择资源' />
              </SelectTrigger>
              <SelectContent>
                {resources.map((resource) => (
                  <SelectItem key={resource.resourceKey} value={resource.resourceKey}>
                    {resource.label} · {resource.resourceKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant='outline'
            disabled={!selected}
            onClick={() =>
              selected && void bulkApi.downloadTemplate(selected.resourceKey, 'xlsx')
            }
          >
            下载 XLSX 模板
          </Button>
          <Button
            variant='outline'
            disabled={!selected}
            onClick={() => selected && void bulkApi.downloadTemplate(selected.resourceKey, 'csv')}
          >
            下载 CSV 模板
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='space-y-3 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>导入</h3>
            <input
              type='file'
              accept='.csv,.json,.xlsx'
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className='block w-full text-sm'
            />
            <div className='flex flex-wrap items-center gap-3'>
              <Select value={mode} onValueChange={(value) => setMode(value as 'partial' | 'atomic')}>
                <SelectTrigger className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='partial'>部分成功</SelectItem>
                  <SelectItem value='atomic'>整批回滚</SelectItem>
                </SelectContent>
              </Select>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={dryRun}
                  onChange={(event) => setDryRun(event.target.checked)}
                />
                仅预检（dry-run）
              </label>
              <Button disabled={!file || busy} onClick={() => void importNow()}>
                {busy ? '处理中…' : '开始导入'}
              </Button>
            </div>
            <div className='space-y-1'>
              <span className='text-xs text-muted-foreground'>
                列映射 JSON（可选：{`{"源列":"字段键"}`}）
              </span>
              <Input
                value={mappingText}
                onChange={(event) => setMappingText(event.target.value)}
                placeholder='{"姓名":"name"}'
              />
            </div>
            {selected ? (
              <p className='text-muted-foreground text-xs'>
                必填字段：
                {selected.fields
                  .filter((field) => field.required)
                  .map((field) => field.key)
                  .join(', ') || '无'}
              </p>
            ) : null}

            <div className='max-h-72 space-y-2 overflow-auto'>
              {imports.map((run) => (
                <div key={run.id} className='rounded border p-2 text-sm'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    <span className='font-mono text-xs'>{run.resourceKey}</span>
                    <span>{run.mode}</span>
                    <span className='text-muted-foreground'>
                      {run.successCount}/{run.rowCount} 成功，{run.failureCount} 失败
                    </span>
                    {run.failureCount > 0 ? (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => void bulkApi.downloadImportErrors(run.id)}
                      >
                        错误报告
                      </Button>
                    ) : null}
                    {['queued', 'running'].includes(run.status) ? (
                      <Button
                        size='sm'
                        variant='destructive'
                        onClick={() => void bulkApi.cancelImport(run.id).then(load)}
                      >
                        取消
                      </Button>
                    ) : null}
                    {['failed', 'cancelled'].includes(run.status) ? (
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() => void bulkApi.retryImport(run.id).then(load)}
                      >
                        重试
                      </Button>
                    ) : null}
                  </div>
                  {run.error ? <p className='text-destructive text-xs'>{run.error}</p> : null}
                </div>
              ))}
              {imports.length === 0 ? (
                <p className='text-muted-foreground text-sm'>暂无导入历史</p>
              ) : null}
            </div>
          </div>

          <div className='space-y-3 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>导出</h3>
            <div className='flex flex-wrap items-center gap-3'>
              <Select value={format} onValueChange={(value) => setFormat(value as BulkExportFormat)}>
                <SelectTrigger className='w-28'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['csv', 'xlsx', 'json', 'md', 'pdf'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={piiPolicy}
                onValueChange={(value) => setPiiPolicy(value as 'allow' | 'mask')}
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='allow'>PII 原样</SelectItem>
                  <SelectItem value='mask'>PII 脱敏</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className='w-48'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='搜索关键词（可选）'
              />
              <Button disabled={busy || !selected} onClick={() => void exportNow()}>
                {busy ? '生成中…' : '创建导出'}
              </Button>
            </div>
            {selected ? (
              <div className='flex max-h-32 flex-wrap gap-2 overflow-auto rounded border p-2'>
                {selected.fields.map((field) => (
                  <label key={field.key} className='flex items-center gap-1 text-xs'>
                    <input
                      type='checkbox'
                      checked={fields.includes(field.key)}
                      disabled={field.exportable === false}
                      onChange={(event) =>
                        setFields((current) =>
                          event.target.checked
                            ? [...current, field.key]
                            : current.filter((key) => key !== field.key),
                        )
                      }
                    />
                    {field.key}
                  </label>
                ))}
              </div>
            ) : null}

            <div className='max-h-72 space-y-2 overflow-auto'>
              {exports.map((run) => (
                <div key={run.id} className='rounded border p-2 text-sm'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    <span className='font-mono text-xs'>{run.resourceKey}</span>
                    <span>{run.format}</span>
                    <span className='text-muted-foreground'>{run.rowCount} 行</span>
                    {run.status === 'succeeded' ? (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => void bulkApi.downloadExport(run.id)}
                      >
                        下载
                      </Button>
                    ) : null}
                    {['queued', 'running'].includes(run.status) ? (
                      <Button
                        size='sm'
                        variant='destructive'
                        onClick={() => void bulkApi.cancelExport(run.id).then(load)}
                      >
                        取消
                      </Button>
                    ) : null}
                  </div>
                  {run.expiresAt ? (
                    <p className='text-muted-foreground text-xs'>过期：{run.expiresAt}</p>
                  ) : null}
                  {run.error ? <p className='text-destructive text-xs'>{run.error}</p> : null}
                </div>
              ))}
              {exports.length === 0 ? (
                <p className='text-muted-foreground text-sm'>暂无导出历史</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
