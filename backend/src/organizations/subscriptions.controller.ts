import { Controller, Post, Get, Body, Param, Req, Res, Headers, RawBodyRequest } from '@nestjs/common'
import { Request, Response } from 'express'
import { StripeService } from './stripe.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'
import { OrganizationId } from './decorators/organization-id.decorator'
import { SUBSCRIPTION_SERVICE } from '../organization-context/domain/services'
import type { ISubscriptionService } from '../organization-context/domain/services'
import { Inject } from '@nestjs/common'

@Controller('organizations/:organizationId/subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly stripeService: StripeService,
    @Inject(SUBSCRIPTION_SERVICE)
    private readonly subscriptionService: ISubscriptionService,
  ) {}

  @Post('checkout')
  @Auth()
  async createCheckoutSession(
    @Param('organizationId') organizationId: string,
    @Body() body: { priceId: string },
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const baseUrl = req.headers.origin || 'http://localhost:3050'
    const successUrl = `${baseUrl}/admin/billing/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/admin/billing`

    const url = await this.subscriptionService.createCheckoutSession(
      organizationId,
      body.priceId,
      successUrl,
      cancelUrl,
    )

    return { url }
  }

  @Post('portal')
  @Auth()
  async createPortalSession(
    @Param('organizationId') organizationId: string,
    @Body() body: { returnUrl: string },
    @CurrentUser() user: User,
  ): Promise<{ url: string }> {
    const url = await this.subscriptionService.createPortalSession(organizationId, body.returnUrl)
    return { url }
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!req.rawBody) {
        res.status(400).send('Webhook Error: Missing raw body')
        return
      }
      await this.subscriptionService.handleWebhook(signature, req.rawBody)
      res.status(200).send('OK')
    } catch (error: any) {
      res.status(400).send(`Webhook Error: ${error?.message || 'Unknown error'}`)
    }
  }
}
