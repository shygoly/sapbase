'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableRowActions, type RowAction } from '@/components/ui/table/data-table-row-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UsersTableProps {
  data: Record<string, any>[]
  selectedUsers: Record<string, any>[]
  onEdit: (user: Record<string, any>) => void
  onDelete: (user: Record<string, any>) => void
  onSelectionChange: (users: Record<string, any>[]) => void
  isLoading?: boolean
}

export function UsersTable({
  data,
  selectedUsers,
  onEdit,
  onDelete,
  onSelectionChange,
  isLoading = false,
}: UsersTableProps) {
  const [selectAll, setSelectAll] = useState(false)

  const handleSelectAll = () => {
    if (selectAll) {
      onSelectionChange([])
      setSelectAll(false)
    } else {
      onSelectionChange(data)
      setSelectAll(true)
    }
  }

  const handleSelectUser = (user: Record<string, any>) => {
    const isSelected = selectedUsers.some(u => u.id === user.id)
    if (isSelected) {
      onSelectionChange(selectedUsers.filter(u => u.id !== user.id))
    } else {
      onSelectionChange([...selectedUsers, user])
    }
  }

  const getRowActions = (user: Record<string, any>): RowAction[] => [
    {
      id: 'edit',
      label: 'Edit',
      onClick: () => onEdit(user),
    },
    {
      id: 'delete',
      label: 'Delete',
      variant: 'destructive',
      onClick: () => onDelete(user),
    },
  ]

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectAll && data.length > 0}
                onChange={handleSelectAll}
                disabled={isLoading}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            data.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.some(u => u.id === user.id)}
                    onChange={() => handleSelectUser(user)}
                    disabled={isLoading}
                  />
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role || '-'}</TableCell>
                <TableCell>
                  {user.status && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.status}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <DataTableRowActions
                    actions={getRowActions(user)}
                    isLoading={isLoading}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
