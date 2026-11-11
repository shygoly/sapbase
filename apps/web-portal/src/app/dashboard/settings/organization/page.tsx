'use client'

import { useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { useBrandConfig } from '@sap/app-shared/contexts/brand-config-context'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import type { UpdateBrandConfigDto } from '@sap/app-shared/lib/api/brand-config'

export default function OrganizationBrandSettingsPage() {
  const { config, updateConfig, loading } = useBrandConfig()
  const [form, setForm] = useState<UpdateBrandConfigDto>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setForm({
      appName: config.appName,
      supportEmail: config.supportEmail,
      supportUrl: config.supportUrl,
      theme: config.theme,
    })
  }, [config])

  const save = async () => {
    setSaving(true)
    try {
      await updateConfig(form)
      setMessage('已保存')
    } catch (error) {
      setMessage((error as Error).message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer
      pageTitle='组织与品牌'
      pageDescription='Portal 内维护租户应用名称、支持信息与品牌色；保存后立即生效。'
    >
      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle>品牌配置</CardTitle>
          <CardDescription>{loading ? '加载中…' : '只影响展示，不改权限与业务数据。'}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1'>
            <Label htmlFor='appName'>应用名称</Label>
            <Input
              id='appName'
              value={form.appName ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, appName: event.target.value }))}
            />
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='supportEmail'>支持邮箱</Label>
              <Input
                id='supportEmail'
                value={form.supportEmail ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supportEmail: event.target.value }))
                }
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='supportUrl'>支持链接</Label>
              <Input
                id='supportUrl'
                value={form.supportUrl ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supportUrl: event.target.value }))
                }
              />
            </div>
          </div>
          <div className='grid gap-3 md:grid-cols-3'>
            {(['primary', 'secondary', 'accent'] as const).map((key) => (
              <div key={key} className='space-y-1'>
                <Label htmlFor={`theme-${key}`}>{key}</Label>
                <Input
                  id={`theme-${key}`}
                  type='color'
                  value={form.theme?.[key] ?? '#000000'}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      theme: { ...(prev.theme ?? config?.theme), [key]: event.target.value } as never,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className='flex items-center gap-3'>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
            {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
