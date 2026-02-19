/**
 * Port for subscription/payment service (implemented in infrastructure, e.g. Stripe).
 */
export interface Subscription {
  id: string
  customerId: string
  status: string
  productId?: string
}

export interface ISubscriptionService {
  createCustomer(
    organizationId: string,
    email: string,
    name: string,
  ): Promise<string> // returns customerId
  createCheckoutSession(
    organizationId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> // returns session URL
  createPortalSession(organizationId: string, returnUrl: string): Promise<string> // returns portal URL
  handleWebhook(signature: string, payload: Buffer): Promise<void>
}
