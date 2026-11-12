import { httpClient } from './client'

export type ImportRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'cancelled'
export type ExportRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type BulkExportFormat = 'csv' | 'json' | 'xlsx' | 'md' | 'pdf'

export interface BulkField {
  key: string
  label: string
  type: string
  required?: boolean
  enumValues?: string[]
  referenceResource?: string
  permissions?: { read?: string; write?: string }
  pii?: boolean
  exportable?: boolean
  importable?: boolean
  example?: string
  description?: string
}

export interface BulkResource {
  resourceKey: string
  label: string
  description?: string
  canImport: boolean
  canExport: boolean
  fields: BulkField[]
  importFormats: string[]
  exportFormats: string[]
}

export interface ImportRun {
  id: string
  organizationId: string
  resourceKey: string
  mode: 'atomic' | 'partial'
  status: ImportRunStatus
  format: string | null
  rowCount: number
  successCount: number
  failureCount: number
  errors: Array<{
    row: number
    sheet?: string
    column?: string
    field?: string
    reason: string
    message: string
  }>
  options: Record<string, unknown>
  error: string | null
  createdBy: string | null
  createdAt: string
}

export interface ExportRun {
  id: string
  organizationId: string
  resourceKey: string
  format: BulkExportFormat
  status: ExportRunStatus
  fields: string[]
  rowCount: number
  assetId: string | null
  mimeType: string | null
  expiresAt: string | null
  error: string | null
  filters: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export interface ImportMapping {
  id: string
  resourceKey: string
  name: string
  mapping: Record<string, unknown>
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

function download(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const bulkApi = {
  async resources(): Promise<BulkResource[]> {
    return unwrap(await httpClient.get('/api/imports/resources'))
  },
  async resource(
    resourceKey: string,
    direction: 'import' | 'export' = 'import',
  ): Promise<BulkResource> {
    return unwrap(
      await httpClient.get('/api/imports/resource', {
        params: { resourceKey, direction },
      }),
    )
  },
  async downloadTemplate(resourceKey: string, format: 'csv' | 'xlsx' = 'xlsx') {
    const response = await httpClient.get('/api/imports/template', {
      params: { resourceKey, format },
      responseType: 'blob',
    })
    download(response.data as Blob, `${resourceKey.replace(/[^a-z0-9._-]+/gi, '-')}-template.${format}`)
  },
  async createImport(input: {
    resourceKey: string
    file?: File
    assetId?: string
    mode?: 'atomic' | 'partial'
    dryRun?: boolean
    mapping?: Record<string, unknown>
    mappingName?: string
    unknownColumns?: 'reject' | 'ignore'
    idempotencyKey?: string
  }): Promise<{ run: ImportRun; jobId: string | null; reused: boolean }> {
    if (input.file) {
      const form = new FormData()
      form.append('file', input.file)
      form.append('resourceKey', input.resourceKey)
      if (input.mode) form.append('mode', input.mode)
      if (input.dryRun) form.append('dryRun', 'true')
      if (input.mapping) form.append('mapping', JSON.stringify(input.mapping))
      if (input.mappingName) form.append('mappingName', input.mappingName)
      if (input.unknownColumns) form.append('unknownColumns', input.unknownColumns)
      if (input.idempotencyKey) form.append('idempotencyKey', input.idempotencyKey)
      return unwrap(await httpClient.post('/api/imports', form))
    }
    return unwrap(
      await httpClient.post('/api/imports', {
        resourceKey: input.resourceKey,
        assetId: input.assetId,
        mode: input.mode,
        dryRun: input.dryRun,
        mapping: input.mapping,
        mappingName: input.mappingName,
        unknownColumns: input.unknownColumns,
        idempotencyKey: input.idempotencyKey,
      }),
    )
  },
  async imports(limit = 50): Promise<ImportRun[]> {
    return unwrap(await httpClient.get('/api/imports', { params: { limit } }))
  },
  async importRun(id: string): Promise<ImportRun> {
    return unwrap(await httpClient.get(`/api/imports/${id}`))
  },
  async downloadImportErrors(id: string) {
    const response = await httpClient.get(`/api/imports/${id}/errors`, {
      responseType: 'blob',
    })
    download(response.data as Blob, `import-${id}-errors.csv`)
  },
  async cancelImport(id: string): Promise<ImportRun> {
    return unwrap(await httpClient.post(`/api/imports/${id}/cancel`, {}))
  },
  async retryImport(id: string): Promise<{ run: ImportRun; jobId: string | null }> {
    return unwrap(await httpClient.post(`/api/imports/${id}/retry`, {}))
  },
  async createExport(input: {
    resourceKey: string
    format?: BulkExportFormat
    fields?: string[]
    filter?: Record<string, unknown>
    sort?: string
    order?: 'asc' | 'desc'
    search?: string
    restrictedFieldPolicy?: 'omit' | 'reject'
    piiPolicy?: 'allow' | 'mask'
  }): Promise<{ run: ExportRun; jobId: string }> {
    return unwrap(await httpClient.post('/api/exports', input))
  },
  async exports(limit = 50): Promise<ExportRun[]> {
    return unwrap(await httpClient.get('/api/exports', { params: { limit } }))
  },
  async exportRun(id: string): Promise<ExportRun> {
    return unwrap(await httpClient.get(`/api/exports/${id}`))
  },
  async downloadExport(id: string) {
    const response = await httpClient.get(`/api/exports/${id}/download`, {
      responseType: 'blob',
    })
    download(response.data as Blob, `export-${id}`)
  },
  async exportUrl(id: string, ttl = 300): Promise<{ url: string; expiresIn: number }> {
    return unwrap(await httpClient.get(`/api/exports/${id}/url`, { params: { ttl } }))
  },
  async cancelExport(id: string): Promise<ExportRun> {
    return unwrap(await httpClient.post(`/api/exports/${id}/cancel`, {}))
  },
  async mappings(resourceKey?: string): Promise<ImportMapping[]> {
    return unwrap(
      await httpClient.get('/api/import-mappings', { params: { resourceKey } }),
    )
  },
  async saveMapping(input: {
    resourceKey: string
    name: string
    mapping: Record<string, unknown>
  }): Promise<ImportMapping> {
    return unwrap(await httpClient.post('/api/import-mappings', input))
  },
  async deleteMapping(id: string): Promise<void> {
    await httpClient.delete(`/api/import-mappings/${id}`)
  },
}
