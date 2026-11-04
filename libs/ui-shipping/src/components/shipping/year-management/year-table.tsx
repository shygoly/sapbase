'use client'

import React from 'react'
import type { YearParameterRecord } from '@sap/api-client/api/shipping/types'
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

interface YearTableProps {
  items: YearParameterRecord[]
  onEdit: (item: YearParameterRecord) => void
  onDelete: (id: string) => void
}

export function YearTable({ items, onEdit, onDelete }: YearTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead className="text-right">FuelEU Target</TableHead>
            <TableHead className="text-right">ETS Coverage</TableHead>
            <TableHead className="text-right">EUA Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No year parameters found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.year}</TableCell>
                <TableCell className="text-right">{item.fuelEuTarget}</TableCell>
                <TableCell className="text-right">{(item.etsCoverageRatio * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-right">{item.euaPrice}</TableCell>
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
