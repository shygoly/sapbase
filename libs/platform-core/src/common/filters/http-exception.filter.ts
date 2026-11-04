import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

// Extend Express Request type to include id property
interface RequestWithId extends Request {
  id?: string
}

interface ErrorResponse {
  statusCode: number
  message: string | string[]
  error?: string
  timestamp: string
  path?: string
  method?: string
  requestId?: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<RequestWithId>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'
    let error = 'Internal Server Error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'object') {
        const { message: msg, error: err } = exceptionResponse as any
        message = msg || exception.message
        error = err || error
      } else {
        message = exception.message
      }
    } else if (exception instanceof Error) {
      message = exception.message
      error = exception.name
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      )
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`)
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.id,
    }

    // Log error details
    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      JSON.stringify(errorResponse),
    )

    response.status(status).json(errorResponse)
  }
}
