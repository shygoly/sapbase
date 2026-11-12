import type { AssetKind } from './asset.entity'

export interface AssetPolicyLimits {
  maxFileBytes: number
  maxOrgBytes: number
  maxConcurrentUploads: number
}

interface AssetRule {
  kind: AssetKind
  mimes: string[]
  prefix?: string
}

const MB = 1024 * 1024
const GB = 1024 * MB

/** 至少覆盖需求中的 7 类格式：图片、PDF、Word、PPT、Excel、音频、视频。 */
export const ASSET_EXTENSION_RULES: Record<string, AssetRule> = {
  jpg: { kind: 'image', mimes: ['image/jpeg'] },
  jpeg: { kind: 'image', mimes: ['image/jpeg'] },
  png: { kind: 'image', mimes: ['image/png'] },
  gif: { kind: 'image', mimes: ['image/gif'] },
  webp: { kind: 'image', mimes: ['image/webp'] },
  svg: { kind: 'image', mimes: ['image/svg+xml'] },
  pdf: { kind: 'document', mimes: ['application/pdf'] },
  doc: { kind: 'document', mimes: ['application/msword'] },
  docx: {
    kind: 'document',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  ppt: { kind: 'document', mimes: ['application/vnd.ms-powerpoint'] },
  pptx: {
    kind: 'document',
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  },
  xls: { kind: 'document', mimes: ['application/vnd.ms-excel'] },
  xlsx: {
    kind: 'document',
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  txt: { kind: 'document', mimes: ['text/plain'], prefix: 'text/' },
  md: { kind: 'document', mimes: ['text/markdown', 'text/plain'], prefix: 'text/' },
  csv: { kind: 'document', mimes: ['text/csv', 'application/csv'], prefix: 'text/' },
  mp3: { kind: 'audio', mimes: ['audio/mpeg'] },
  wav: { kind: 'audio', mimes: ['audio/wav', 'audio/x-wav'] },
  m4a: { kind: 'audio', mimes: ['audio/mp4', 'audio/x-m4a'] },
  ogg: { kind: 'audio', mimes: ['audio/ogg'] },
  mp4: { kind: 'video', mimes: ['video/mp4'], prefix: 'video/' },
  webm: { kind: 'video', mimes: ['video/webm'], prefix: 'video/' },
  mov: { kind: 'video', mimes: ['video/quicktime'], prefix: 'video/' },
  m4v: { kind: 'video', mimes: ['video/x-m4v'], prefix: 'video/' },
  zip: { kind: 'archive', mimes: ['application/zip', 'application/x-zip-compressed'] },
}

export function resolveAssetPolicy(env: NodeJS.ProcessEnv = process.env): AssetPolicyLimits {
  return {
    maxFileBytes: positiveNumber(env.ASSET_MAX_FILE_BYTES, 200 * MB),
    maxOrgBytes: positiveNumber(env.ASSET_ORG_MAX_BYTES, 10 * GB),
    maxConcurrentUploads: positiveNumber(env.ASSET_MAX_CONCURRENT_UPLOADS, 10),
  }
}

export function validateAssetMetadata(
  input: { originalName: string; mimeType: string; size: number },
  limits: AssetPolicyLimits,
): string | null {
  if (!input.originalName || !input.mimeType) return 'originalName/mimeType 必填'
  if (!Number.isFinite(input.size) || input.size <= 0) return '文件大小非法'
  if (input.size > limits.maxFileBytes) {
    return `文件大小超过上限 ${limits.maxFileBytes} bytes`
  }
  const extension = extensionOf(input.originalName)
  const rule = ASSET_EXTENSION_RULES[extension]
  if (!rule) return `不支持的文件扩展名：${extension || '(none)'}`
  const mime = input.mimeType.toLowerCase()
  const matched = rule.prefix
    ? mime.startsWith(rule.prefix) || rule.mimes.includes(mime)
    : rule.mimes.includes(mime)
  if (!matched) return `MIME ${input.mimeType} 与扩展名 .${extension} 不匹配`
  return null
}

export function kindFromAssetNameOrMime(
  originalName: string,
  mimeType: string,
): AssetKind {
  const rule = ASSET_EXTENSION_RULES[extensionOf(originalName)]
  if (rule) return rule.kind
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document'
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return 'archive'
  return 'other'
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
