/**
 * Paginated result interface
 * Used for all paginated API responses
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
