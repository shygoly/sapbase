import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { Request } from 'express'
import { ApiResponseDto } from '../dto/api-response.dto'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>()
    const path = request.url

    return next.handle().pipe(
      map((data) => {
        // If data is already an ApiResponseDto, return as is
        if (data instanceof ApiResponseDto) {
          return data
        }

        // If data has code and message properties, assume it's already formatted
        if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
          return data
        }

        // Otherwise, wrap in ApiResponseDto
        return ApiResponseDto.success(data, 'Success', path)
      }),
    )
  }
}
