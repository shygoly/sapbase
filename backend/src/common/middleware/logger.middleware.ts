import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(req: Request, res: Response, next: NextFunction) {
    // Add request ID
    const requestId = uuidv4()
    ;(req as any).id = requestId

    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent')
    const startTime = Date.now()

    // Log incoming request
    this.logger.log(
      `[${requestId}] ${method} ${originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`,
    )

    // Capture response
    const loggerInstance = this.logger
    const originalSend = res.send
    res.send = function (data: any) {
      const duration = Date.now() - startTime
      const statusCode = res.statusCode

      // Log response
      loggerInstance.log(
        `[${requestId}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms`,
      )

      // Call original send
      return originalSend.call(this, data)
    }

    next()
  }
}
