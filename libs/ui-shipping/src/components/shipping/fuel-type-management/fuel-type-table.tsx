'use client'

import React from 'react'
import type { FuelTypeRecord } from '@sap/api-client/api/shipping/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sap/ui-kit/table'
import { Button } from '@sap/ui-kit/button'
import { Badge } from '@sap/ui-kit/badge'
import { Trash2, Edit2 } from 'lucide-react'

interface FuelTypeTableProps {
  items: FuelTypeRecord[]
  onEdit: (item: FuelTypeRecord) => void
  onDelete: (id: string) => void
  canEditSystem?: boolean
}

export function FuelTypeTable({ items, onEdit, onDelete, canEditSystem = true }: FuelTypeTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead className="text-right">CO₂ Factor</TableHead>
            <TableHead className="text-right">Default Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No fuel types found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const price = item.defaultPrice ?? item.price ?? 0
              const isSystem = item.scope === 'system'
              const canEdit = isSystem ? canEditSystem : true
              const canDelete = !isSystem
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.code ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={isSystem ? 'secondary' : 'outline'}>
                      {isSystem ? 'System' : 'Tenant'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.co2Factor}</TableCell>
                  <TableCell className="text-right">{price}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
