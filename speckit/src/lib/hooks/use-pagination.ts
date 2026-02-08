'use client'

import { useState, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export function usePagination(initialPageSize: number = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [total, setTotal] = useState(0)

  const totalPages = Math.ceil(total / pageSize)

  const goToPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages))
    setPage(validPage)
  }, [totalPages])

  const nextPage = useCallback(() => {
    goToPage(page + 1)
  }, [page, goToPage])

  const prevPage = useCallback(() => {
    goToPage(page - 1)
  }, [page, goToPage])

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize)
    setPage(1)
  }, [])

  const reset = useCallback(() => {
    setPage(1)
    setTotal(0)
  }, [])

  return {
    page,
    pageSize,
    total,
    totalPages,
    setTotal,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    reset,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}
