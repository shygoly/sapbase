import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import { useState, type UIEvent } from 'react';
import type * as React from 'react';

import { DataTablePagination } from './data-table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../table';
import { getCommonPinningStyles } from '../lib/data-table';
import { ScrollArea, ScrollBar } from '../scroll-area';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  /** 超过该行数启用窗口化渲染；小表保持原路径。 */
  virtualizeThreshold?: number;
  rowHeight?: number;
  viewportHeight?: number;
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  virtualizeThreshold = 100,
  rowHeight = 41,
  viewportHeight = 640,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows
  const [scrollTop, setScrollTop] = useState(0)
  const virtual = rows.length > virtualizeThreshold
  const overscan = 6
  const start = virtual
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    : 0
  const end = virtual
    ? Math.min(rows.length, start + Math.ceil(viewportHeight / rowHeight) + overscan * 2)
    : rows.length
  const visible = rows.slice(start, end)
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (virtual) setScrollTop(event.currentTarget.scrollTop)
  }

  if (virtual) {
    return (
      <div className='flex flex-1 flex-col space-y-4'>
        {children}
        <div className='relative flex flex-1'>
          <div
            className='w-full overflow-auto rounded-lg border'
            style={{ maxHeight: viewportHeight }}
            onScroll={onScroll}
            data-virtualized='true'
          >
            <Table>
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {start > 0 ? (
                  <TableRow aria-hidden>
                    <TableCell colSpan={table.getAllColumns().length} style={{ height: start * rowHeight, padding: 0 }} />
                  </TableRow>
                ) : null}
                {visible.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} style={{ height: rowHeight }}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {end < rows.length ? (
                  <TableRow aria-hidden>
                    <TableCell colSpan={table.getAllColumns().length} style={{ height: (rows.length - end) * rowHeight, padding: 0 }} />
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className='flex flex-col gap-2.5'>
          <DataTablePagination table={table} />
          {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {children}
      <div className='relative flex flex-1'>
        <div className='absolute inset-0 flex overflow-hidden rounded-lg border'>
          <ScrollArea className='h-full w-full'>
            <Table>
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column })
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonPinningStyles({ column: cell.column })
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getAllColumns().length}
                      className='h-24 text-center'
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation='horizontal' />
          </ScrollArea>
        </div>
      </div>
      <div className='flex flex-col gap-2.5'>
        <DataTablePagination table={table} />
        {actionBar &&
          table.getFilteredSelectedRowModel().rows.length > 0 &&
          actionBar}
      </div>
    </div>
  );
}
