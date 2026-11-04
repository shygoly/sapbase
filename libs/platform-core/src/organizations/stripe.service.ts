import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Organization, SubscriptionStatus } from './organization.entity'

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null
  private isConfigured: boolean = false

  constructor(
    private configService: ConfigService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY')
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2026-01-28.clover' as any,
      })
      this.isConfigured = true
    } else {
      console.warn('STRIPE_SECRET_KEY is not configured. Stripe features will be disabled.')
    }
  }

  private ensureConfigured(): void {
    if (!this.isConfigured || !this.stripe) {
      throw new BadRequestException('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.')
    }
  }

  async createCustomer(organizationId: string, email: string, name: string): Promise<string> {
    this.ensureConfigured()
    const customer = await this.stripe!.customers.create({
      email,
      name,
      metadata: {
        organizationId,
      },
    })

    await this.organizationRepository.update(organizationId, {
      stripeCustomerId: customer.id,
    })

    return customer.id
  }

  async createCheckoutSession(
    organizationId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    this.ensureConfigured()
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    })

    if (!organization) {
      throw new BadRequestException('Organization not found')
    }

    let customerId = organization.stripeCustomerId
    if (!customerId) {
      // Create customer if doesn't exist
      customerId = await this.createCustomer(organizationId, '', organization.name)
    }

    const session = await this.stripe!.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organizationId,
      },
    })

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session')
    }
    return session.url
  }

  async createPortalSession(organizationId: string, returnUrl: string): Promise<string> {
    this.ensureConfigured()
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    })

    if (!organization || !organization.stripeCustomerId) {
      throw new BadRequestException('Organization does not have a Stripe customer')
    }

    const session = await this.stripe!.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: returnUrl,
    })

    if (!session.url) {
      throw new BadRequestException('Failed to create portal session')
    }
    return session.url
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    this.ensureConfigured()
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured')
    }

    let event: Stripe.Event

    try {
      event = this.stripe!.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err?.message || 'Unknown error'}`)
    }

    const organizationId = (event.data?.object as any)?.metadata?.organizationId || 
                          (event as any).metadata?.organizationId

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string
    const organization = await this.organizationRepository.findOne({
      where: { stripeCustomerId: customerId },
    })

    if (!organization) {
      return
    }

    const status = this.mapSubscriptionStatus(subscription.status)
    const productId = subscription.items.data[0]?.price.product as string

    await this.organizationRepository.update(organization.id, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      stripeProductId: productId,
    })
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string
    const organization = await this.organizationRepository.findOne({
      where: { stripeCustomerId: customerId },
    })

    if (!organization) {
      return
    }

    await this.organizationRepository.update(organization.id, {
      subscriptionStatus: SubscriptionStatus.CANCELLED,
    })
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string
    const organization = await this.organizationRepository.findOne({
      where: { stripeCustomerId: customerId },
    })

    if (!organization) {
      return
    }

    // Update subscription status to active if payment succeeded
    if (organization.subscriptionStatus === SubscriptionStatus.PAST_DUE) {
      await this.organizationRepository.update(organization.id, {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      })
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string
    const organization = await this.organizationRepository.findOne({
      where: { stripeCustomerId: customerId },
    })

    if (!organization) {
      return
    }

    await this.organizationRepository.update(organization.id, {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    })
  }

  private mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELLED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    }

    return statusMap[stripeStatus] || SubscriptionStatus.INCOMPLETE
  }
}
