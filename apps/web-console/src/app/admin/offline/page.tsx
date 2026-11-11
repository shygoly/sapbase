'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  offlineApi,
  type OfflineEntitlementRecord,
  type OfflinePackageRecord,
} from '@sap/api-client'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'

const pageModel: PageModel = {
  id: 'offline-admin',
  title: '离线内容',
  description: '离线包 / manifest 签名 / 设备 / 授权 / 清理',
  permissions: ['offline:read'],
}

export default function OfflineAdminPage() {
  const [packages, setPackages] = useState<OfflinePackageRecord[]>([])
  const [entitlements, setEntitlements] = useState<OfflineEntitlementRecord[]>([])
  const [key, setKey] = useState(`course-${Date.now()}`)
  const [title, setTitle] = useState('离线课程包')
  const [assetIds, setAssetIds] = useState('')
  const [userId, setUserId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setPackages(await offlineApi.packages())
      setEntitlements(await offlineApi.entitlements())
    } catch (error) {
      setMessage((error as Error).message || '加载失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      setMessage(success)
      await load()
    } catch (error) {
      setMessage((error as Error).message || '操作失败')
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <div className='space-y-4'>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={() => void run(() => offlineApi.cleanup(), '已清理过期/撤销授权')}>
            清理过期授权
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>创建离线包</CardTitle>
            <CardDescription>资产必须 ready；AI 内容必须已有显式/隐式标识</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='flex flex-wrap gap-2'>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder='key' />
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='标题' />
              <Input
                value={assetIds}
                onChange={(e) => setAssetIds(e.target.value)}
                placeholder='assetId1,assetId2'
                className='min-w-72'
              />
              <Button
                onClick={() =>
                  void run(
                    () =>
                      offlineApi.createPackage({
                        key,
                        title,
                        assets: assetIds
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((assetId) => ({ assetId })),
                        publish: true,
                      }),
                    '离线包已创建并发布',
                  )
                }
              >
                创建
              </Button>
            </div>
            <div className='space-y-2'>
              {packages.map((pkg) => (
                <div key={pkg.id} className='flex flex-wrap items-center gap-2 text-sm'>
                  <Badge variant={pkg.status === 'published' ? 'default' : 'secondary'}>
                    {pkg.status}
                  </Badge>
                  <span>
                    {pkg.key} v{pkg.version}
                  </span>
                  <span className='text-muted-foreground'>{pkg.title}</span>
                  {pkg.status === 'draft' ? (
                    <Button size='sm' variant='outline' onClick={() => void run(() => offlineApi.publish(pkg.id), '已发布')}>
                      发布
                    </Button>
                  ) : null}
                  {pkg.status !== 'revoked' ? (
                    <Button size='sm' variant='ghost' onClick={() => void run(() => offlineApi.revokePackage(pkg.id), '已撤销')}>
                      撤销
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>设备与授权</CardTitle>
            <CardDescription>设备上限 OFFLINE_MAX_DEVICES（默认 3）</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='flex flex-wrap gap-2'>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder='userId' />
              <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder='deviceId' />
              <Button
                onClick={() => void run(() => offlineApi.registerDevice({ deviceId }), '设备已注册')}
                disabled={!deviceId}
              >
                注册设备
              </Button>
              <Button
                variant='outline'
                onClick={() =>
                  void run(
                    () =>
                      offlineApi.grant(packages[0]?.id ?? '', { userId, deviceId }),
                    '授权已创建',
                  )
                }
                disabled={!packages[0] || !userId || !deviceId}
              >
                授权首包
              </Button>
            </div>
            <div className='space-y-1 text-sm'>
              {entitlements.map((row) => (
                <div key={row.id} className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{row.status}</Badge>
                  <span>{row.userId}</span>
                  <span className='text-muted-foreground'>{row.deviceId}</span>
                  <span className='text-muted-foreground'>
                    至 {new Date(row.expiresAt).toLocaleString()}
                  </span>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => void run(() => offlineApi.revokeEntitlement(row.id), '已撤销')}
                  >
                    撤销
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageRuntime>
  )
}
