'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { identityApi, type ServiceClientRecord } from '@sap/api-client'

export default function IdentityGovernancePage() {
  const [clients, setClients] = useState<ServiceClientRecord[]>([])
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState('integrations.read')
  const [secret, setSecret] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setClients(await identityApi.serviceClients())
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载服务客户端失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    try {
      const result = await identityApi.createServiceClient({
        key,
        name: name || key,
        scopes: scopes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      setSecret(result.secret)
      setMessage('服务客户端已创建；secret 只显示一次')
      setKey('')
      setName('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '创建失败')
    }
  }

  return (
    <PageContainer
      pageTitle='身份与服务令牌'
      pageDescription='服务客户端只证明组织/scope；代用户调用由业务端重新解析权限与数据范围。'
    >
      <div className='space-y-4'>
        <div className='grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>key</span>
            <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder='sis-sync' />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>scopes（逗号分隔）</span>
            <Input value={scopes} onChange={(event) => setScopes(event.target.value)} />
          </div>
          <div className='flex items-end'>
            <Button disabled={!key} onClick={() => void create()}>
              创建客户端
            </Button>
          </div>
        </div>
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}
        {secret ? (
          <p className='rounded border border-amber-500/40 bg-amber-500/10 p-3 font-mono text-xs'>
            secret: {secret}
          </p>
        ) : null}

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>服务客户端</h3>
          {clients.map((client) => (
            <div key={client.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                {client.status}
              </Badge>
              <span className='font-mono text-xs'>{client.key}</span>
              <span>{client.name}</span>
              <span className='text-muted-foreground'>
                scopes: {(client.scopes ?? []).join(', ') || '(none)'}
              </span>
              <span className='text-muted-foreground'>
                last used: {client.lastUsedAt ? new Date(client.lastUsedAt).toLocaleString() : '-'}
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  void identityApi.rotateServiceClient(client.id).then((result) => {
                    setSecret(result.secret)
                    setMessage(`已轮换 ${client.key}；旧 secret 立即失效`)
                    return load()
                  })
                }
              >
                轮换 secret
              </Button>
              <Button
                size='sm'
                variant='secondary'
                onClick={() =>
                  void identityApi
                    .updateServiceClient(client.id, {
                      status: client.status === 'active' ? 'inactive' : 'active',
                    })
                    .then(load)
                }
              >
                {client.status === 'active' ? '停用' : '启用'}
              </Button>
            </div>
          ))}
          {clients.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无服务客户端</p>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}
