import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * Interceptor to ensure all queries are filtered by organizationId
 * This is a safety net - services should already filter by organizationId
 * This interceptor can be used to add additional filtering or validation
 */
@Injectable()
export class DataIsolationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const organizationId = request.organizationId

    // Store organizationId in request for use in services
    // Services should use this to filter queries
    if (organizationId) {
      request.organizationId = organizationId
    }

    return next.handle().pipe(
      map((data) => {
        // Additional validation can be added here
        // For now, just pass through
        return data
      }),
    )
  }
}
