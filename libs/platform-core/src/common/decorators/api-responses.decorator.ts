import { applyDecorators, Type } from '@nestjs/common'
import { ApiResponse, ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { PaginatedResponseDto } from '../dto/api-response.dto'

/**
 * Standard error responses for all endpoints
 * Includes common HTTP error codes
 */
export function ApiStandardResponses() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Not Found' }),
    ApiResponse({ status: 500, description: 'Internal Server Error' }),
  )
}

/**
 * Paginated response schema for Swagger
 * @param model - The model type for the data array
 */
export function ApiPaginatedResponse<T>(model: Type<T>) {
  return applyDecorators(
    ApiOkResponse({
      description: 'Paginated response',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  )
}

/**
 * Standard CRUD operation responses
 * @param entityName - Name of the entity for response descriptions
 */
export function ApiCrudResponses(entityName: string) {
  return applyDecorators(
    ApiResponse({ status: 200, description: `${entityName} retrieved successfully` }),
    ApiResponse({ status: 201, description: `${entityName} created successfully` }),
    ApiResponse({ status: 204, description: `${entityName} deleted successfully` }),
    ApiStandardResponses(),
  )
}
