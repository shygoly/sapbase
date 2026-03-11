import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TableColumn } from '@/lib/api/shipping/types'

export function DataTable<T extends object>({ columns, rows }: { columns: TableColumn<T>[]; rows: T[] }) {
  return (
    <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
      <Table>
        <TableHeader className='bg-slate-50'>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)} className={column.align === 'right' ? 'text-right' : ''}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={String(column.key)} className={column.align === 'right' ? 'text-right' : ''}>
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[String(column.key)] ?? '--')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
