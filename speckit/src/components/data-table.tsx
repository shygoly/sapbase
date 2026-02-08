'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export interface DataTableColumn<T> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T extends { id: string }> {
  columns: DataTableColumn<T>[]
  data: T[]
  onRowSelect?: (row: T) => void
  onRowsSelect?: (rows: T[]) => void
  selectable?: boolean
  pageSize?: number
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowSelect,
  onRowsSelect,
  selectable = false,
  pageSize = 10,
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    return data.filter(row =>
      columns.some(col => {
        const value = row[col.key]
        return String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    )
  }, [data, searchTerm, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      if (aVal === bVal) return 0
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      return sortDirection === 'asc' ? 1 : -1
    })
  }, [filteredData, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (field: keyof T) => {
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
    setCurrentPage(1)
  }

  const handleSelectRow = (row: T) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(row.id)) {
      newSelected.delete(row.id)
    } else {
      newSelected.add(row.id)
    }
    setSelectedRows(newSelected)

    if (onRowsSelect) {
      const selected = paginatedData.filter(r => newSelected.has(r.id))
      onRowsSelect(selected)
    }
  }

  const handleSelectAll = () => {
    const newSelected = new Set(selectedRows)
    const allSelected = paginatedData.every(r => newSelected.has(r.id))

    if (allSelected) {
      paginatedData.forEach(r => newSelected.delete(r.id))
    } else {
      paginatedData.forEach(r => newSelected.add(r.id))
    }

    setSelectedRows(newSelected)

    if (onRowsSelect) {
      const selected = paginatedData.filter(r => newSelected.has(r.id))
      onRowsSelect(selected)
    }
  }

  const getSortIcon = (field: keyof T) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value)
            setCurrentPage(1)
          }}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('')
              setCurrentPage(1)
            }}
            className="absolute right-3 top-3"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={paginatedData.length > 0 && paginatedData.every(r => selectedRows.has(r.id))}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-sm font-medium"
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-foreground"
                    >
                      {col.label}
                      {getSortIcon(col.key)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(row => (
              <tr
                key={row.id}
                className="border-t hover:bg-muted/50 cursor-pointer"
                onClick={() => onRowSelect?.(row)}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRows.has(row.id)}
                      onChange={() => handleSelectRow(row)}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td key={String(col.key)} className="px-4 py-3 text-sm">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({sortedData.length} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
