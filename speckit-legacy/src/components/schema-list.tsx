'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import type { ObjectSchema, FieldDefinition } from '@/core/schema/types'

interface SchemaListProps {
  schema: ObjectSchema
  data: Record<string, any>[]
  onRowClick?: (row: Record<string, any>) => void
  onEdit?: (row: Record<string, any>) => void
  onDelete?: (row: Record<string, any>) => void
  isLoading?: boolean
}

type SortDirection = 'asc' | 'desc' | null

export function SchemaList({
  schema,
  data,
  onRowClick,
  onEdit,
  onDelete,
  isLoading = false,
}: SchemaListProps) {
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [filteredData, setFilteredData] = useState(data)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    let sorted = [...data]

    if (sortField && sortDirection) {
      sorted.sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]

        if (aVal === bVal) return 0
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        return sortDirection === 'asc' ? 1 : -1
      })
    }

    setFilteredData(sorted)
    setCurrentPage(1) // Reset to first page when data changes
  }, [data, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Get visible fields (exclude hidden fields)
  const visibleFields = schema.fields.filter(f => !f.hidden)

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (filteredData.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No data</div>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted border-b">
            <tr>
              {visibleFields.map(field => (
                <th
                  key={field.name}
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => handleSort(field.name)}
                >
                  <div className="flex items-center gap-2">
                    {field.label}
                    {sortField === field.name && (
                      <span>
                        {sortDirection === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr
                key={idx}
                className="border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {visibleFields.map(field => (
                  <td key={field.name} className="px-4 py-3 text-sm">
                    {renderCellValue(row[field.name], field)}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onEdit(row)
                          }}
                          className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDelete(row)
                          }}
                          className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show first page, last page, current page, and pages around current
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)

              if (!showPage && page === 2) {
                return <PaginationEllipsis key="ellipsis-start" />
              }
              if (!showPage && page === totalPages - 1) {
                return <PaginationEllipsis key="ellipsis-end" />
              }
              if (!showPage) return null

              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            })}

            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

function renderCellValue(value: any, field: FieldDefinition): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>
  }

  switch (field.type) {
    case 'checkbox':
      return value ? '✓' : '✗'

    case 'date':
    case 'datetime':
      return new Date(value).toLocaleDateString()

    case 'select':
      const option = field.options?.find(o => o.value === value)
      return option?.label || value

    default:
      return String(value).substring(0, 100)
  }
}
