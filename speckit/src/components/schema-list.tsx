'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleFields.map(field => (
                <TableHead
                  key={field.name}
                  className="cursor-pointer hover:bg-muted/50"
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
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead>Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, idx) => (
              <TableRow
                key={idx}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {visibleFields.map(field => (
                  <TableCell key={field.name}>
                    {renderCellValue(row[field.name], field)}
                  </TableCell>
                ))}
                {(onEdit || onDelete) && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(row)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(row)
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
