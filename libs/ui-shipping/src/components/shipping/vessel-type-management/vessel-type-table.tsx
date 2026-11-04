'use client'

import React from 'react'
import type { CiiShipTypeParameterRecord } from '@sap/api-client/api/shipping/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sap/ui-kit/table'
import { Button } from '@sap/ui-kit/button'
import { Trash2, Edit2 } from 'lucide-react'

interface VesselTypeTableProps {
  items: CiiShipTypeParameterRecord[]
  onEdit: (item: CiiShipTypeParameterRecord) => void
  onDelete: (id: string) => void
}

export function VesselTypeTable({ items, onEdit, onDelete }: VesselTypeTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ship Type</TableHead>
            <TableHead>Standard</TableHead>
            <TableHead className="text-right">Range Min</TableHead>
            <TableHead className="text-right">Range Max</TableHead>
            <TableHead className="text-right">Reference CII</TableHead>
            <TableHead className="text-right">Required CII</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No vessel type parameters found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.shipType}</TableCell>
                <TableCell>{item.applicableStandard}</TableCell>
                <TableCell className="text-right">{item.rangeMin}</TableCell>
                <TableCell className="text-right">{item.rangeMax ?? '∞'}</TableCell>
                <TableCell className="text-right">{item.referenceCii}</TableCell>
                <TableCell className="text-right">{item.requiredCii}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
