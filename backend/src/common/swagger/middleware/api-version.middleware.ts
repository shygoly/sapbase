import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

/**
 * Middleware to handle API versioning via header.
 * 
 * Usage:
 * ```typescript
 * app.use(new ApiVersionMiddleware().use)
 * ```
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const apiVersion = req.headers['x-api-version'] || 'v1'
    
    // Set default version if not specified
    if (!req.headers['x-api-version']) {
      req.headers['x-api-version'] = 'v1'
    }

    // Add version to request for use in controllers
    ;(req as any).apiVersion = apiVersion

    next()
  }
}
