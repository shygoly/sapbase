'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { useOrganizationStore } from '@sap/app-shared/core/store/organization.store'
import { organizationsApi } from '@sap/api-client'

interface SubscriptionStatus {
  configured: boolean
  organization: {
    id: string
    name: string
    planName: string | null
    subscriptionStatus: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    stripeProductId: string | null
  }
}

export default function BillingPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id ?? ''
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!organizationId) return
    try {
      setStatus(await organizationsApi.getSubscriptionStatus(organizationId))
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载订阅状态失败')
    }
  }, [organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const openPortal = async () => {
    if (!organizationId) return
    setBusy(true)
    try {
      const { url } = await organizationsApi.createPortalSession(
        organizationId,
        window.location.href,
      )
      window.location.assign(url)
    } catch (error) {
      setMessage((error as Error).message || '无法打开 Stripe Customer Portal')
    } finally {
      setBusy(false)
    }
  }

  if (!organizationId) {
    return (
      <PageContainer pageTitle='账单与订阅' pageDescription='请先选择组织。'>
        <p className='text-muted-foreground text-sm'>当前没有选中的组织。</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      pageTitle='账单与订阅'
      pageDescription='查看当前计划/状态；Stripe Checkout 与 Customer Portal 由后端签发短时会话。'
    >
      <div className='space-y-4'>
        {status ? (
          <div className='flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm'>
            <Badge variant={status.organization.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
              {status.organization.subscriptionStatus}
            </Badge>
            <span>组织：{status.organization.name}</span>
            <span>计划：{status.organization.planName ?? '未设置'}</span>
            <span className='text-muted-foreground'>
              Stripe：{status.configured ? '已配置' : '未配置 STRIPE_SECRET_KEY'}
            </span>
            {status.organization.stripeCustomerId ? (
              <span className='font-mono text-xs text-muted-foreground'>
                {status.organization.stripeCustomerId}
              </span>
            ) : null}
          </div>
        ) : null}

        {!status?.configured ? (
          <p className='rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
            当前环境未配置 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`。页面可预览，
            Checkout/Portal 在配置密钥后可用。
          </p>
        ) : null}
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}

        <div className='grid gap-4 md:grid-cols-3'>
          {[
            { key: 'starter', name: 'Starter', price: '$0', desc: '单组织基础能力' },
            { key: 'pro', name: 'Pro', price: '$29/月', desc: '团队协作与更多配额' },
            { key: 'enterprise', name: 'Enterprise', price: '联系销售', desc: '专属部署与支持' },
          ].map((plan) => (
            <div key={plan.key} className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>{plan.name}</h3>
              <p className='text-2xl font-semibold'>{plan.price}</p>
              <p className='text-muted-foreground text-sm'>{plan.desc}</p>
              <Button
                className='w-full'
                variant={plan.key === 'pro' ? 'default' : 'outline'}
                disabled={busy || !status?.configured || plan.key === 'starter'}
                onClick={() => {
                  const priceId =
                    plan.key === 'pro'
                      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO
                      : process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE
                  if (!priceId) {
                    setMessage(`缺少 NEXT_PUBLIC_STRIPE_PRICE_${plan.key.toUpperCase()}`)
                    return
                  }
                  void organizationsApi
                    .createCheckoutSession(organizationId, priceId)
                    .then(({ url }) => window.location.assign(url))
                    .catch((error) => setMessage((error as Error).message || '创建 Checkout 失败'))
                }}
              >
                {plan.key === 'starter' ? '当前可用' : '升级'}
              </Button>
            </div>
          ))}
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' disabled={busy || !status?.configured} onClick={() => void openPortal()}>
            打开 Stripe Customer Portal
          </Button>
          <Button variant='secondary' onClick={() => void load()}>
            刷新状态
          </Button>
        </div>

        <p className='text-muted-foreground text-sm'>
          订阅状态由 Stripe webhook 同步到 `organizations.subscriptionStatus`；前端不信任回跳参数。
        </p>
      </div>
    </PageContainer>
  )
}
