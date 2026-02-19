import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger'

/**
 * Enhanced API operation decorator with comprehensive documentation.
 */
export function ApiOperationEnhanced(options: {
  summary: string
  description?: string
  deprecated?: boolean
  tags?: string[]
}) {
  return ApiOperation({
    summary: options.summary,
    description: options.description,
    deprecated: options.deprecated,
    tags: options.tags,
  })
}

/**
 * Decorator to add comprehensive endpoint documentation.
 */
export function ApiEndpoint(options: {
  summary: string
  description?: string
  responses?: Array<{
    status: number
    description: string
    example?: any
  }>
  params?: Array<{
    name: string
    description: string
    required?: boolean
    example?: any
  }>
  query?: Array<{
    name: string
    description: string
    required?: boolean
    type?: string
    example?: any
  }>
  body?: {
    description?: string
    example?: any
  }
  deprecated?: boolean
}) {
  const decorators = [
    ApiOperationEnhanced({
      summary: options.summary,
      description: options.description,
      deprecated: options.deprecated,
    }),
  ]

  // Add parameters
  if (options.params) {
    options.params.forEach((param) => {
      decorators.push(
        ApiParam({
          name: param.name,
          description: param.description,
          required: param.required !== false,
          example: param.example,
        }),
      )
    })
  }

  // Add query parameters
  if (options.query) {
    options.query.forEach((query) => {
      decorators.push(
        ApiQuery({
          name: query.name,
          description: query.description,
          required: query.required !== false,
          type: query.type as any,
          example: query.example,
        }),
      )
    })
  }

  // Add body
  if (options.body) {
    decorators.push(
      ApiBody({
        description: options.body.description,
        examples: options.body.example
          ? {
              default: {
                value: options.body.example,
              },
            }
          : undefined,
      }),
    )
  }

  // Add responses
  if (options.responses) {
    options.responses.forEach((response) => {
      decorators.push(
        ApiResponse({
          status: response.status,
          description: response.description,
          schema: response.example
            ? {
                example: response.example,
              }
            : undefined,
        }),
      )
    })
  }

  return applyDecorators(...decorators)
}
