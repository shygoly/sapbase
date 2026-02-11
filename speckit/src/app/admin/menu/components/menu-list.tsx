'use client'

import React from 'react'
import { MenuItem } from '@/lib/api/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, ChevronRight } from 'lucide-react'

interface MenuListProps {
  items: MenuItem[]
  onEdit: (item: MenuItem) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

function MenuItemRow({
  item,
  level = 0,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  item: MenuItem
  level?: number
  onEdit: (item: MenuItem) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}) {
  const hasChildren = item.children && item.children.length > 0
  const indent = level * 20

  return (
    <>
      <TableRow>
        <TableCell style={{ paddingLeft: `${indent + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren && <ChevronRight className="h-4 w-4 text-gray-400" />}
            <span>{item.label}</span>
          </div>
        </TableCell>
        <TableCell>{item.path || '-'}</TableCell>
        <TableCell>{item.icon || '-'}</TableCell>
        <TableCell>
          {item.permissions && item.permissions.length > 0
            ? item.permissions.join(', ')
            : '-'}
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              item.visible
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {item.visible ? 'Visible' : 'Hidden'}
          </span>
        </TableCell>
        <TableCell className="text-right">{item.order}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(item)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {hasChildren &&
        item.children?.map((child) => (
          <MenuItemRow
            key={child.id}
            item={child}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
    </>
  )
}

export function MenuList({
  items,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: MenuListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">No menu items found</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Icon</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead className="text-right">Order</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
