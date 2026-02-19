import { applyDecorators } from '@nestjs/common'
import { ApiExtraModels, getSchemaPath, ApiResponse } from '@nestjs/swagger'

/**
 * Decorator to add example responses to API endpoints.
 * 
 * Usage:
 * ```typescript
 * @ApiExampleResponse({ status: 200, example: { id: '123', name: 'Example' } })
 * ```
 */
export function ApiExampleResponse(options: {
  status: number
  description?: string
  example: any
  schema?: any
}) {
  return ApiResponse({
    status: options.status,
    description: options.description || `Example response for status ${options.status}`,
    schema: options.schema || {
      example: options.example,
    },
  })
}

/**
 * Decorator to add multiple example responses.
 */
export function ApiExampleResponses(examples: Array<{
  status: number
  description?: string
  example: any
}>) {
  return applyDecorators(
    ...examples.map((ex) =>
      ApiResponse({
        status: ex.status,
        description: ex.description,
        schema: {
          example: ex.example,
        },
      }),
    ),
  )
}

/**
 * Decorator to add paginated response example.
 */
export function ApiPaginatedResponse<T>(options: {
  status?: number
  description?: string
  type: new () => T
  example?: T[]
}) {
  return applyDecorators(
    ApiExtraModels(options.type),
    ApiResponse({
      status: options.status || 200,
      description:
        options.description ||
        'Paginated response with data array and pagination metadata',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(options.type) },
            example: options.example || [],
          },
          total: {
            type: 'number',
            example: 100,
          },
          page: {
            type: 'number',
            example: 1,
          },
          limit: {
            type: 'number',
            example: 10,
          },
          totalPages: {
            type: 'number',
            example: 10,
          },
        },
      },
    }),
  )
}
