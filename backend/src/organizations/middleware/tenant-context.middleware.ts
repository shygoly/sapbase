import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common'
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

    organizationId = req.headers['x-organization-id'] as string
    if (!organizationId) {
      organizationId = req.query.organizationId as string
    }
    if (!organizationId && (req as any).user?.organizationId) {
      organizationId = (req as any).user.organizationId
    }
    if (!organizationId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '')
        const payload = this.jwtService.decode(token) as { organizationId?: string; sub?: string } | null
        organizationId = payload?.organizationId
        userIdFromToken = payload?.sub
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
