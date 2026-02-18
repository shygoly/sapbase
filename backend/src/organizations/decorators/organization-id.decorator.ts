import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Decorator to extract organizationId from request
 * Used after TenantContextMiddleware has set req.organizationId
 */
export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.organizationId
  },
)
