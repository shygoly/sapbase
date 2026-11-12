'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Button } from '@sap/app-shared/components/ui/button'
import { useAuthStore } from '@sap/app-shared/core/store/auth.store'
import { useOrganizationStore } from '@sap/app-shared/core/store/organization.store'
import { organizationsApi } from '@sap/api-client'

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
}

const PLANS = [
  { key: 'starter', name: 'Starter', price: '$0', desc: '单组织基础能力', priceKey: null },
  { key: 'pro', name: 'Pro', price: '$29/月', desc: '团队协作与更多配额', priceKey: 'pro' },
  { key: 'enterprise', name: 'Enterprise', price: '联系销售', desc: '专属部署与支持', priceKey: 'enterprise' },
]

export default function PricingPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const [message, setMessage] = useState<string | null>(null)

  const checkout = async (priceKey: string | null) => {
    if (!isAuthenticated) {
      router.push('/login?returnUrl=/pricing')
      return
    }
    if (!currentOrganization?.id) {
      setMessage('请先在 Dashboard 选择组织')
      return
    }
    if (!priceKey) {
      setMessage('Starter 计划无需 Checkout')
      return
    }
    const priceId = PRICE_IDS[priceKey]
    if (!priceId) {
      setMessage(`缺少环境变量 NEXT_PUBLIC_STRIPE_PRICE_${priceKey.toUpperCase()}`)
      return
    }
    try {
      const { url } = await organizationsApi.createCheckoutSession(
        currentOrganization.id,
        priceId,
      )
      window.location.assign(url)
    } catch (error) {
      setMessage((error as Error).message || '创建 Checkout 失败')
    }
  }

  return (
    <PageContainer
      pageTitle='定价'
      pageDescription='Starter 免费；Pro/Enterprise 通过 Stripe Checkout 订阅，状态由 webhook 同步。'
    >
      <div className='space-y-4'>
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}
        <div className='grid gap-4 md:grid-cols-3'>
          {PLANS.map((plan) => (
            <div key={plan.key} className='space-y-3 rounded-lg border bg-card p-5'>
              <h2 className='font-medium'>{plan.name}</h2>
              <p className='text-3xl font-semibold'>{plan.price}</p>
              <p className='text-muted-foreground text-sm'>{plan.desc}</p>
              <Button
                className='w-full'
                variant={plan.key === 'pro' ? 'default' : 'outline'}
                onClick={() => void checkout(plan.priceKey)}
              >
                {plan.key === 'starter' ? '开始使用' : '选择计划'}
              </Button>
            </div>
          ))}
        </div>
        <p className='text-muted-foreground text-sm'>
          价格 ID 由 `NEXT_PUBLIC_STRIPE_PRICE_PRO` / `NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE`
          提供；密钥只在后端环境变量中。
        </p>
      </div>
    </PageContainer>
  )
}
