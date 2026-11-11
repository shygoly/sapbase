'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sap/ui-kit/table'
import { Button } from '@sap/ui-kit/button'
import type { ObjectSchema, FieldDefinition } from '../schema/types'
import { formatFieldValue } from '../format'

interface SchemaListProps {
  schema: ObjectSchema
  data: Record<string, any>[]
  onRowClick?: (row: Record<string, any>) => void
  onEdit?: (row: Record<string, any>) => void
  onDelete?: (row: Record<string, any>) => void
  isLoading?: boolean
}

type SortDirection = 'asc' | 'desc' | null

export function sortRows(
  data: Record<string, any>[],
  sortField: string | null,
  sortDirection: SortDirection,
): Record<string, any>[] {
  if (!sortField || !sortDirection) return [...data]
  return [...data].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (aVal === bVal) return 0
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    return sortDirection === 'asc' ? 1 : -1
  })
}

export function paginateRows(
  data: Record<string, any>[],
  page: number,
  perPage = 10,
): Record<string, any>[] {
  const start = (Math.max(1, page) - 1) * perPage
  return data.slice(start, start + perPage)
}

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
    setFilteredData(sortRows(data, sortField, sortDirection))
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
  const paginatedData = paginateRows(filteredData, currentPage, itemsPerPage)

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (filteredData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No data
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
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
                          variant="ghost"
                          size="sm"
                          aria-label="Edit"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(row)
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(row)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
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
      return formatFieldValue(value, field.type)

    case 'select':
      const option = field.options?.find(o => o.value === value)
      return option?.label || value

    default:
      return formatFieldValue(value, field.type, { unit: field.unit }).substring(0, 100)
  }
}
