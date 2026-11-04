import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { OrganizationsService } from '../organizations.service'

/**
 * Guard to ensure user has access to the organization in the request context
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private organizationsService: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const organizationId = request.organizationId

    if (!user || !organizationId) {
      throw new ForbiddenException('User or organization context missing')
    }

    // Check if user is a member of the organization
    const role = await this.organizationsService.getUserRole(organizationId, user.id)
    if (!role) {
      throw new ForbiddenException('User does not have access to this organization')
    }

    // Store user's role in request for use in controllers
    request.userRole = role

    return true
  }
}
