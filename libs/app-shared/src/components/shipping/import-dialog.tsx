'use client'

import { useMemo, useState } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { useNotification } from '../../core/ui/ui-hooks'
import { voyagesApi } from '../../lib/api/shipping/voyages.api'
import type { VoyageImportResult } from '../../lib/api/shipping/types'
import { DataTable } from './data-table'

export function ImportDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<VoyageImportResult | null>(null)
  const notification = useNotification()

  const fileLabel = useMemo(() => {
    if (!file) return 'Choose standard voyage .xlsx template'
    return `${file.name} • ${(file.size / 1024).toFixed(1)} KB`
  }, [file])

  const handleImport = async () => {
    if (!file) {
      notification.error('Please choose an .xlsx file first')
      return
    }

    setIsSubmitting(true)
    try {
      const importResult = await voyagesApi.importFile(file)
      setResult(importResult)
      notification.success(`Imported ${importResult.summary.successCount} rows`)
      onImported?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Voyage import failed'
      notification.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className='bg-[#1677ff] text-white hover:bg-[#0958d9]'>
          <Upload className='mr-2 h-4 w-4' />
          Import Voyage
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Import Voyage</DialogTitle>
          <DialogDescription>
            Upload the standard `.xlsx` voyage template. The backend returns row-level validation and claimed / unclaimed status.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <label className='flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6'>
            <div className='flex items-center gap-4'>
              <div className='rounded-xl bg-emerald-100 p-3 text-emerald-700'>
                <FileSpreadsheet className='h-5 w-5' />
              </div>
              <div>
                <div className='font-medium text-slate-900'>{fileLabel}</div>
                <div className='mt-1 text-sm text-slate-500'>Required headers: Ship IMO, Voyage No, Departure Port, Arrival Port, Departure Date, Arrival Date, Distance NM, Emissions, Through Ice</div>
              </div>
            </div>
            <input
              type='file'
              accept='.xlsx'
              className='hidden'
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span className='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700'>Choose File</span>
          </label>

          {result ? (
            <div className='grid gap-4'>
              <div className='grid gap-3 md:grid-cols-3'>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                  <div className='text-xs uppercase tracking-[0.2em] text-slate-500'>Total Rows</div>
                  <div className='mt-2 text-2xl font-semibold text-slate-950'>{result.summary.totalRows}</div>
                </div>
                <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-4'>
                  <div className='text-xs uppercase tracking-[0.2em] text-emerald-600'>Success</div>
                  <div className='mt-2 text-2xl font-semibold text-emerald-700'>{result.summary.successCount}</div>
                </div>
                <div className='rounded-xl border border-rose-200 bg-rose-50 p-4'>
                  <div className='text-xs uppercase tracking-[0.2em] text-rose-600'>Failed</div>
                  <div className='mt-2 text-2xl font-semibold text-rose-700'>{result.summary.failureCount}</div>
                </div>
              </div>

              <DataTable
                columns={[
                  { key: 'rowNumber', header: 'Row', align: 'right' },
                  { key: 'status', header: 'Status' },
                  { key: 'voyageStatus', header: 'Voyage Status' },
                  {
                    key: 'errors',
                    header: 'Errors',
                    render: (row) =>
                      Array.isArray(row.errors) && row.errors.length > 0
                        ? row.errors.join('; ')
                        : '--',
                  },
                ]}
                rows={result.rows}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button className='bg-[#1677ff] text-white hover:bg-[#0958d9]' onClick={handleImport} disabled={isSubmitting || !file}>
            {isSubmitting ? 'Importing...' : 'Start Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
