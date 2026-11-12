import type { ImportMode } from './bulk.entities'

export type BulkFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'decimal'
  | 'enum'
  | 'reference'
  | 'json'

export interface BulkFieldPermissions {
  read?: string
  write?: string
}

export interface ResourceField {
  /** 稳定字段键，同时也是导入表头/导出列名。 */
  key: string
  label: string
  type: BulkFieldType
  required?: boolean
  enumValues?: string[]
  referenceResource?: string
  permissions?: BulkFieldPermissions
  /** 敏感字段：默认允许导出，可按策略脱敏/拒绝。 */
  pii?: boolean
  /** false 表示永不出现在导出（如密码、内部摘要）。 */
  exportable?: boolean
  /** false 表示模板/导入不接受该列（如计算字段/系统字段）。 */
  importable?: boolean
  /** 导入时允许的别名/旧表头。 */
  aliases?: string[]
  example?: string
  description?: string
  /** 缺省值：导入缺列/空值时使用（不绕过必填语义时应同时声明 required）。 */
  default?: unknown
}

export interface ResourceDescriptor {
  resourceKey: string
  label: string
  description?: string
  canImport: boolean
  canExport: boolean
  fields: ResourceField[]
  importFormats: Array<'csv' | 'json' | 'xlsx'>
  exportFormats: Array<'csv' | 'json' | 'xlsx' | 'md' | 'pdf'>
}

export interface BulkActor {
  id: string
  permissions: string[]
  email?: string
  role?: string | null
}

export interface ImportWriteOptions {
  mode: ImportMode
  dryRun: boolean
  /** 取消协作：长循环应轮询。 */
  isCancelled?: () => Promise<boolean>
  onProgress?: (done: number, total: number) => Promise<void>
  /** 适配器理解的附加选项。 */
  adapterOptions?: Record<string, unknown>
}

export interface ImportWriteRow {
  /** 文件行号/JSON 下标（从 1 开始）。 */
  row: number
  data: Record<string, unknown>
}

export interface RowError {
  row: number
  sheet?: string
  column?: string
  field?: string
  reason: string
  message: string
}

export interface ImportWriteResult {
  imported: number
  validated: number
  errors: RowError[]
}

export interface ExportQuery {
  page: number
  pageSize: number
  filter?: Record<string, unknown>
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
}

export interface ExportPage {
  rows: Array<Record<string, unknown>>
  total: number
}

export interface AdapterContext {
  organizationId: string
  actor: BulkActor
  resourceKey: string
}

export interface ImportAdapter {
  readonly namespace: string
  supports(resourceKey: string): boolean
  describe(ctx: AdapterContext): Promise<ResourceDescriptor>
  listResources?(ctx: AdapterContext): Promise<ResourceDescriptor[]>
  write(
    ctx: AdapterContext,
    rows: ImportWriteRow[],
    options: ImportWriteOptions,
  ): Promise<ImportWriteResult>
}

export interface ExportAdapter {
  readonly namespace: string
  supports(resourceKey: string): boolean
  describe(ctx: AdapterContext): Promise<ResourceDescriptor>
  listResources?(ctx: AdapterContext): Promise<ResourceDescriptor[]>
  exportPage(ctx: AdapterContext, query: ExportQuery): Promise<ExportPage>
}

export interface ParsedImportRow {
  row: number
  sheet?: string
  values: Record<string, string>
}

export interface ParsedImportFile {
  format: 'csv' | 'json' | 'xlsx'
  headers: string[]
  rows: ParsedImportRow[]
  sheet?: string
}

export interface ColumnMappingResult {
  headers: string[]
  fieldByHeader: Map<string, string>
  errors: RowError[]
}

export interface PreparedImportRow {
  row: number
  sheet?: string
  data: Record<string, unknown>
  errors: RowError[]
}
