import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'

export const CurrentApp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): BusinessAppExecutionContext => {
    const request = context.switchToHttp().getRequest()
    return request.appContext
  },
)
