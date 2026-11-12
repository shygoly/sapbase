import { Controller, ForbiddenException, Get, Inject, Put, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { extname } from 'node:path'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.vtt': 'text/vtt',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
}

/**
 * 本地对象存储的签名 URL 端点（开发/测试）。
 * URL 只由 LocalObjectStorage.signedUrl 生成，带 op + expires；生产使用 S3 provider。
 */
@Controller('local-storage')
export class LocalStorageController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  private keyOf(req: Request): string {
    const raw = (req.params as Record<string, string>)[0] ?? ''
    return decodeURIComponent(raw)
  }

  private assertSigned(req: Request, op: 'read' | 'write'): void {
    const expires = Number(req.query.expires ?? 0)
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('签名 URL 已过期')
    }
    if (req.query.op !== op) throw new ForbiddenException('签名 URL 操作不符')
  }

  @Get('*')
  async read(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertSigned(req, 'read')
    const key = this.keyOf(req)
    const body = await this.storage.get(key)
    const range = req.headers.range
    res.setHeader('Content-Type', MIME[extname(key).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      const start = match?.[1] ? Number(match[1]) : 0
      const end = match?.[2] ? Number(match[2]) : body.length - 1
      const slice = body.subarray(start, end + 1)
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`)
      res.setHeader('Content-Length', String(slice.length))
      res.end(slice)
      return
    }
    res.setHeader('Content-Length', String(body.length))
    res.end(body)
  }

  @Put('*')
  async write(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertSigned(req, 'write')
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = Buffer.concat(chunks)
    const contentType = req.headers['content-type']
    await this.storage.put(this.keyOf(req), body, {
      contentType: typeof contentType === 'string' ? contentType : undefined,
    })
    res.status(201).json({ key: this.keyOf(req), size: body.length })
  }
}
