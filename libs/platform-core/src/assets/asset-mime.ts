import { extname } from 'node:path'
import type { AssetKind } from './asset.entity'

export const ASSET_ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'pdf',
  'mp4',
  'mov',
  'webm',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'csv',
  'json',
  'md',
  'zip',
])

const OFFICE_MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export class AssetMimeError extends Error {
  constructor(
    message: string,
    readonly reason: 'unsupported' | 'mismatch' | 'too-large' | 'unsafe',
  ) {
    super(message)
    this.name = 'AssetMimeError'
  }
}

export function kindFromMime(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('presentationml')
  ) {
    return 'document'
  }
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return 'archive'
  return 'other'
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  return bytes.every((byte, index) => buffer[index] === byte)
}

function ascii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('latin1')
}

/** 只读取文件头，不信任客户端 MIME。 */
export function sniffMime(buffer: Buffer, filename: string): string | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(buffer, 0, 4) === '%PDF') return 'application/pdf'
  if (ascii(buffer, 0, 4) === 'PK\u0003\u0004') {
    const ext = extname(filename).slice(1).toLowerCase()
    return OFFICE_MIME[ext] ?? 'application/zip'
  }
  if (ascii(buffer, 4, 4) === 'ftyp') {
    const brand = ascii(buffer, 8, 4)
    if (brand.startsWith('qt')) return 'video/quicktime'
    return 'video/mp4'
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WAVE') return 'audio/wav'
  if (ascii(buffer, 0, 4) === 'OggS') return 'audio/ogg'
  if (ascii(buffer, 0, 3) === 'ID3' || startsWith(buffer, [0xff, 0xfb])) return 'audio/mpeg'
  if (ascii(buffer, 4, 4) === 'ftypM4A ') return 'audio/mp4'
  const head = buffer.subarray(0, 512).toString('utf8')
  if (/^\s*</.test(head) && /<svg[\s>]/i.test(head)) return 'image/svg+xml'
  if (/^\s*[[{]/.test(head)) return 'application/json'
  if (!head.includes('\u0000')) return 'text/plain'
  return null
}

export function assertAssetFile(input: {
  buffer: Buffer
  filename: string
  declaredMime?: string
  size?: number
  maxBytes?: number
}): { mimeType: string; kind: AssetKind; extension: string } {
  const maxBytes = input.maxBytes ?? Number(process.env.ASSET_MAX_FILE_BYTES ?? 200 * 1024 * 1024)
  const size = input.size ?? input.buffer.length
  if (size <= 0 || size > maxBytes) {
    throw new AssetMimeError(`文件大小非法（上限 ${maxBytes} bytes）`, 'too-large')
  }
  const extension = extname(input.filename).slice(1).toLowerCase()
  if (!extension || !ASSET_ALLOWED_EXTENSIONS.has(extension)) {
    throw new AssetMimeError(`不允许的文件扩展名：${extension || '(none)'}`, 'unsupported')
  }
  const sniffed = sniffMime(input.buffer, input.filename)
  if (!sniffed) {
    throw new AssetMimeError('无法识别文件类型（拒绝未知二进制）', 'unsupported')
  }
  if (sniffed === 'image/svg+xml') {
    if (process.env.ASSET_ALLOW_SVG !== 'true') {
      throw new AssetMimeError('SVG 默认拒绝（可配置 ASSET_ALLOW_SVG=true）', 'unsafe')
    }
    const text = input.buffer.toString('utf8')
    if (/<script\b|on\w+\s*=|href\s*=\s*["']https?:/i.test(text)) {
      throw new AssetMimeError('SVG 含脚本/外部引用，拒绝', 'unsafe')
    }
  }
  const declared = (input.declaredMime ?? '').toLowerCase()
  if (
    declared &&
    declared !== 'application/octet-stream' &&
    declared !== sniffed &&
    !(declared === 'image/jpg' && sniffed === 'image/jpeg') &&
    !(declared.startsWith('text/') && sniffed === 'text/plain')
  ) {
    throw new AssetMimeError(`文件类型不符：声明 ${declared}，实际 ${sniffed}`, 'mismatch')
  }
  return { mimeType: sniffed, kind: kindFromMime(sniffed), extension }
}
