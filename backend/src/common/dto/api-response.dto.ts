/**
 * Unified API Response Format
 */

export interface ApiResponse<T = any> {
  code: number
  message: string
  data?: T
  timestamp: string
  path?: string
}

export interface PaginatedResponse<T = any> {
  code: number
  message: string
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
  path?: string
}

export class ApiResponseDto<T = any> implements ApiResponse<T> {
  code: number
  message: string
  data?: T
  timestamp: string
  path?: string

  constructor(
    code: number,
    message: string,
    data?: T,
    path?: string,
  ) {
    this.code = code
    this.message = message
    this.data = data
    this.timestamp = new Date().toISOString()
    this.path = path
  }

  static success<T>(
    data: T,
    message = 'Success',
    path?: string,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(200, message, data, path)
  }

  static created<T>(
    data: T,
    message = 'Created',
    path?: string,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(201, message, data, path)
  }

  static error(
    code: number,
    message: string,
    path?: string,
  ): ApiResponseDto {
    return new ApiResponseDto(code, message, undefined, path)
  }
}

export class PaginatedResponseDto<T = any> implements PaginatedResponse<T> {
  code: number
  message: string
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
  path?: string

  constructor(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message = 'Success',
    path?: string,
  ) {
    this.code = 200
    this.message = message
    this.data = data
    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
    this.timestamp = new Date().toISOString()
    this.path = path
  }

  static create<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message = 'Success',
    path?: string,
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(data, page, pageSize, total, message, path)
  }
}
