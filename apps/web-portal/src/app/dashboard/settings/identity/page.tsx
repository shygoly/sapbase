'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { identityApi, type IdentityProviderRecord } from '@sap/api-client'

export default function IdentitySettingsPage() {
  const [providers, setProviders] = useState<IdentityProviderRecord[]>([])
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'cas' | 'oauth2' | 'oidc' | 'saml'>('oidc')
  const [defaultRoleName, setDefaultRoleName] = useState('')
  const [secretRef, setSecretRef] = useState('')
  const [config, setConfig] = useState(
    '{\n  "issuer": "https://idp.example.com",\n  "clientId": "sapbase",\n  "redirectUri": "http://localhost:3050/login"\n}',
  )
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setProviders(await identityApi.providers())
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载身份提供方失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createProvider = async () => {
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>
      await identityApi.createProvider({
        key,
        name: name || key,
        type,
        config: parsed,
        secretRef: secretRef || undefined,
        defaultRoleName: defaultRoleName || undefined,
      })
      setMessage('身份提供方已创建')
      setKey('')
      setName('')
      setSecretRef('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '创建失败')
    }
  }

  return (
    <PageContainer
      pageTitle='身份与 SSO'
      pageDescription='按组织配置 CAS / OAuth2 / OIDC / SAML；JIT 只给默认角色，secret 只存引用。'
    >
      <div className='space-y-4'>
        <div className='grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>key</span>
            <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder='corp-oidc' />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>type</span>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='cas'>CAS</SelectItem>
                <SelectItem value='oauth2'>OAuth2</SelectItem>
                <SelectItem value='oidc'>OIDC</SelectItem>
                <SelectItem value='saml'>SAML</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>默认角色（JIT）</span>
            <Input
              value={defaultRoleName}
              onChange={(event) => setDefaultRoleName(event.target.value)}
              placeholder='Student'
            />
          </div>
          <div className='space-y-1 md:col-span-2'>
            <span className='text-xs text-muted-foreground'>secretRef（env:NAME）</span>
            <Input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} />
          </div>
          <div className='space-y-1 md:col-span-3'>
            <span className='text-xs text-muted-foreground'>config JSON</span>
            <textarea
              className='min-h-28 w-full rounded border bg-background p-2 font-mono text-xs'
              value={config}
              onChange={(event) => setConfig(event.target.value)}
            />
          </div>
          <div className='flex items-end'>
            <Button disabled={!key} onClick={() => void createProvider()}>
              创建身份提供方
            </Button>
          </div>
        </div>
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>已配置提供方</h3>
          {providers.map((provider) => (
            <div key={provider.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                {provider.status}
              </Badge>
              <span className='font-mono text-xs'>{provider.key}</span>
              <span>{provider.name}</span>
              <span className='uppercase'>{provider.type}</span>
              <span className='text-muted-foreground'>
                JIT: {provider.defaultRoleName ?? '(无)'}
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  void identityApi
                    .updateProvider(provider.id, {
                      status: provider.status === 'active' ? 'inactive' : 'active',
                    })
                    .then(load)
                }
              >
                {provider.status === 'active' ? '停用' : '启用'}
              </Button>
              <Button
                size='sm'
                variant='destructive'
                onClick={() => void identityApi.removeProvider(provider.id).then(load)}
              >
                删除
              </Button>
            </div>
          ))}
          {providers.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无身份提供方</p>
          ) : null}
        </section>

        <section className='rounded-lg border bg-card p-4 text-sm'>
          <h3 className='mb-2 font-medium'>登录入口</h3>
          <p className='text-muted-foreground'>
            登录页会读取 `GET /api/identity/sso/providers?organizationId=...`；
            授权入口 `GET /api/identity/sso/:key/authorize`，回调
            `POST /api/auth/sso/:key/callback`。SAML 浏览器 POST 需在 IdP 侧配置 ACS。
          </p>
        </section>
      </div>
    </PageContainer>
  )
}
