import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Decorator to extract current organization from request
 * Used after TenantContextMiddleware has set req.organization
 */
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.organization
  },
)
