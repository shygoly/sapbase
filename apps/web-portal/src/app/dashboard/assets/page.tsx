'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  assetsApi,
  type AssetRecord,
  type AssetVariantRecord,
} from '@sap/api-client'

function badgeVariant(status: string) {
  if (status === 'ready') return 'default' as const
  if (status === 'quarantined' || status === 'failed') return 'destructive' as const
  return 'secondary' as const
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof assetsApi.usage>> | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [crop, setCrop] = useState({ left: '', top: '', width: '', height: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [variants, setVariants] = useState<Record<string, AssetVariantRecord[]>>({})
  const [urls, setUrls] = useState<Record<string, Array<{ kind: string; url: string }>>>({})

  const load = useCallback(async () => {
    try {
      const [list, quota] = await Promise.all([assetsApi.list({ pageSize: 24 }), assetsApi.usage()])
      setAssets(list.items)
      setUsage(quota)
      const nextVariants: Record<string, AssetVariantRecord[]> = {}
      const nextUrls: Record<string, Array<{ kind: string; url: string }>> = {}
      for (const asset of list.items) {
        nextVariants[asset.id] = await assetsApi.variants(asset.id)
        if (asset.status === 'ready') {
          nextUrls[asset.id] = await assetsApi.variantUrls(asset.id)
        }
      }
      setVariants(nextVariants)
      setUrls(nextUrls)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载资产失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const cropMeta = Object.fromEntries(
        Object.entries(crop)
          .map(([key, value]) => [key, Number(value)])
          .filter(([, value]) => Number.isFinite(value) && Number(value) > 0),
      )
      const metadata =
        Object.keys(cropMeta).length === 4 ? { crop: cropMeta } : undefined
      const result = await assetsApi.uploadFile(file, metadata)
      setMessage(`已上传，资产处理中：${result.assetId.slice(0, 8)}`)
      for (let index = 0; index < 60; index += 1) {
        const asset = await assetsApi.get(result.assetId)
        if (asset.status !== 'scanning' && asset.status !== 'processing' && asset.status !== 'uploading') {
          setMessage(`资产 ${asset.status}`)
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
      setFile(null)
      await load()
    } catch (error) {
      setMessage((error as Error).message || '上传失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer
      pageTitle='资产与媒体'
      pageDescription='分片上传 / 扫描 / 图片裁剪缩略图 / 视频 MP4/HLS / Range 串流。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4'>
          <input
            type='file'
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className='block text-sm'
          />
          <div className='flex items-end gap-2'>
            {(['left', 'top', 'width', 'height'] as const).map((key) => (
              <div key={key} className='space-y-1'>
                <span className='text-xs text-muted-foreground'>{key}</span>
                <Input
                  className='w-20'
                  value={crop[key]}
                  onChange={(event) => setCrop({ ...crop, [key]: event.target.value })}
                  placeholder='px'
                />
              </div>
            ))}
          </div>
          <Button disabled={!file || busy} onClick={() => void upload()}>
            {busy ? '处理中…' : '上传'}
          </Button>
          {usage ? (
            <span className='text-muted-foreground text-sm'>
              已用 {Math.round(usage.usedBytes / 1024 / 1024)} MB / 上限{' '}
              {Math.round(usage.limitBytes / 1024 / 1024)} MB；活跃上传 {usage.activeUploads}
            </span>
          ) : null}
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {assets.map((asset) => {
            const thumb = urls[asset.id]?.find((item) => item.kind === 'thumbnail')?.url
            const preview = urls[asset.id]?.find((item) => item.kind === 'preview')?.url
            const hls = urls[asset.id]?.find((item) => item.kind === 'hls')?.url
            const mp4 = urls[asset.id]?.find((item) => item.kind === 'mp4')?.url
            return (
              <div key={asset.id} className='space-y-2 rounded-lg border bg-card p-3'>
                <div className='flex items-center gap-2'>
                  <Badge variant={badgeVariant(asset.status)}>{asset.status}</Badge>
                  <span className='truncate text-sm font-medium'>{asset.originalName}</span>
                </div>
                <p className='text-muted-foreground text-xs'>
                  {asset.kind} · {asset.mimeType} · {Math.round(Number(asset.size) / 1024)} KB
                  {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
                  {asset.durationMs ? ` · ${(asset.durationMs / 1000).toFixed(1)}s` : ''}
                </p>
                {asset.kind === 'image' && thumb ? (
                  <img src={thumb} alt={asset.originalName} className='max-h-48 rounded object-contain' />
                ) : null}
                {asset.kind === 'video' && (hls || mp4) ? (
                  <video
                    controls
                    className='max-h-48 w-full rounded'
                    src={hls || mp4}
                    poster={thumb}
                  />
                ) : null}
                {asset.kind === 'document' && preview ? (
                  <img src={preview} alt='preview' className='max-h-48 rounded object-contain' />
                ) : null}
                <div className='flex flex-wrap gap-1'>
                  {(variants[asset.id] ?? []).map((variant) => (
                    <span key={variant.id} className='rounded border px-1.5 py-0.5 text-[10px]'>
                      {variant.kind}
                    </span>
                  ))}
                </div>
                <div className='flex gap-2'>
                  {asset.status === 'failed' || asset.status === 'quarantined' ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      onClick={() => void assetsApi.process(asset.id).then(load)}
                    >
                      重试处理
                    </Button>
                  ) : null}
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() => void assetsApi.remove(asset.id).then(load)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        {assets.length === 0 ? (
          <p className='text-muted-foreground text-sm'>暂无资产</p>
        ) : null}
      </div>
    </PageContainer>
  )
}
