import { ApiProperty } from '@nestjs/swagger'

/**
 * Standard error response DTO for Swagger documentation.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string | string[]

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string

  @ApiProperty({
    description: 'API path where the error occurred',
    example: '/api/users',
  })
  path: string
}

/**
 * Validation error response DTO.
 */
export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Validation errors',
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' },
    },
    example: {
      email: ['email must be an email'],
      password: ['password must be longer than or equal to 8 characters'],
    },
  })
  errors?: Record<string, string[]>
}
