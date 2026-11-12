import { BadRequestException } from '@nestjs/common'

const stripeMock = {
  customers: { create: jest.fn(async () => ({ id: 'cus_1' })) },
  checkout: { sessions: { create: jest.fn(async () => ({ url: 'https://checkout.example' })) } },
  billingPortal: { sessions: { create: jest.fn(async () => ({ url: 'https://portal.example' })) } },
  webhooks: { constructEvent: jest.fn() },
}

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeMock)
})

import { StripeService } from '@sap/platform-core/organizations/stripe.service'

function serviceWith(key: string | undefined, org: any = { id: 'org-1', name: 'Acme', stripeCustomerId: null }) {
  const config = { get: jest.fn((name: string) => (name === 'STRIPE_SECRET_KEY' ? key : undefined)) }
  const repository = {
    findOne: jest.fn(async () => org),
    update: jest.fn(async () => ({ affected: 1 })),
  }
  return {
    service: new StripeService(config as never, repository as never),
    repository,
  }
}

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.example' })
    stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: 'https://portal.example' })
    stripeMock.customers.create.mockResolvedValue({ id: 'cus_1' })
  })

  it('未配置 STRIPE_SECRET_KEY → checkout/portal fail-closed', async () => {
    const { service } = serviceWith(undefined)
    await expect(
      service.createCheckoutSession('org-1', 'price_1', 'https://ok', 'https://cancel'),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.createPortalSession('org-1', 'https://return'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('配置后：创建 customer 并回写组织', async () => {
    const { service, repository } = serviceWith('sk_test')
    await expect(service.createCustomer('org-1', 'a@example.com', 'Acme')).resolves.toBe('cus_1')
    expect(repository.update).toHaveBeenCalledWith('org-1', { stripeCustomerId: 'cus_1' })
  })

  it('配置后：checkout/portal 返回 URL', async () => {
    const { service } = serviceWith('sk_test', {
      id: 'org-1',
      name: 'Acme',
      stripeCustomerId: 'cus_1',
    })
    await expect(
      service.createCheckoutSession('org-1', 'price_1', 'https://ok', 'https://cancel'),
    ).resolves.toBe('https://checkout.example')
    await expect(
      service.createPortalSession('org-1', 'https://return'),
    ).resolves.toBe('https://portal.example')
  })

  it('缺少 webhook secret → fail-closed', async () => {
    const { service } = serviceWith('sk_test')
    await expect(service.handleWebhook('sig', Buffer.from('{}'))).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
