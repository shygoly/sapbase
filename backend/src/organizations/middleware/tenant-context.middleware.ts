import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember } from '../organization-member.entity'
import { JwtService } from '@nestjs/jwt'

/**
 * Middleware to extract and validate organization context from request
 * Sets req.organizationId and req.organization for downstream use
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
    private jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract organizationId from:
    // 1. X-Organization-Id header (preferred)
    // 2. organizationId query parameter
    // 3. JWT token (if present) - middleware runs before guard so we decode here
    let organizationId: string | undefined
    let userIdFromToken: string | undefined
    let tokenOrganizationId: string | undefined

    organizationId = req.headers['x-organization-id'] as string
    if (!organizationId) {
      organizationId = req.query.organizationId as string
    }
    if (!organizationId && (req as any).user?.organizationId) {
      organizationId = (req as any).user.organizationId
    }
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '')
        const payload = this.jwtService.decode(token) as { organizationId?: string; sub?: string } | null
        tokenOrganizationId = payload?.organizationId
        userIdFromToken = payload?.sub
        if (!organizationId) organizationId = tokenOrganizationId
      } catch (error) {
        // Ignore JWT decode errors, will be handled by auth guard
      }
    }

    // Some endpoints don't require organization context (e.g., organization management, auth)
    // Note: req.path is relative to global prefix 'api', so '/api/auth/login' becomes '/auth/login'
    const publicPaths = ['/organizations', '/auth', '/invitations']
    const isPublicPath = publicPaths.some((path) => req.path.startsWith(path)) || 
                        req.originalUrl.startsWith('/api/organizations') ||
                        req.originalUrl.startsWith('/api/auth') ||
                        req.originalUrl.startsWith('/api/invitations')

    // Skip organization context requirement for public paths
    if (isPublicPath || req.path === '/health' || req.originalUrl === '/api/health') {
      next()
      return
    }

    if (organizationId && userIdFromToken) {
      if (
        tokenOrganizationId &&
        tokenOrganizationId !== organizationId
      ) {
        throw new ForbiddenException(
          'X-Organization-Id 与当前令牌组织不一致；请先切换组织',
        )
      }

      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: userIdFromToken },
        relations: ['organization'],
      })
      if (!membership) {
        throw new ForbiddenException('当前用户不属于请求指定的组织')
      }
      ;(req as any).organization = membership.organization
    }

    // For protected paths, try to get organizationId
    if (!organizationId) {
      // Try from user's default organization (single membership) using userId from token
      if (userIdFromToken) {
        const memberships = await this.memberRepository.find({
          where: { userId: userIdFromToken },
          relations: ['organization'],
        })
        if (memberships.length === 1) {
          organizationId = memberships[0].organizationId
          ;(req as any).organization = memberships[0].organization
        }
      }

      // Require organization only when token was valid (we got userId) but still no org
      if (!organizationId && userIdFromToken) {
        throw new BadRequestException('Organization context is required. Provide X-Organization-Id header or organizationId query parameter.')
      }
      // If no token or invalid token, let the request through so JwtAuthGuard returns 401
    }

    if (organizationId) {
      ;(req as any).organizationId = organizationId
      // Organization object already loaded above if single org
    }

    next()
  }
}
