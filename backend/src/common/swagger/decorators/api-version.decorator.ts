import { SetMetadata } from '@nestjs/common'

export const API_VERSION_KEY = 'apiVersion'
export const API_VERSION_HEADER = 'X-API-Version'

/**
 * Decorator to mark endpoints with API version.
 * 
 * Usage:
 * ```typescript
 * @ApiVersion('v1')
 * @Get('users')
 * ```
 */
export const ApiVersion = (version: string) => SetMetadata(API_VERSION_KEY, version)

/**
 * Get API version from metadata.
 */
export function getApiVersion(target: any): string | undefined {
  return Reflect.getMetadata(API_VERSION_KEY, target)
}
