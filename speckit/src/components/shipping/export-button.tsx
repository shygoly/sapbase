'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/core/ui/ui-hooks'
import { reportsApi } from '@/lib/api/shipping/reports.api'

export function ExportButton({
  label = 'Export Report',
  reportType,
  vesselId,
  year,
}: {
  label?: string
  reportType: string
  vesselId?: string
  year?: string
}) {
  const [isExporting, setIsExporting] = useState(false)
  const notification = useNotification()

  return (
    <Button
      className='bg-[#1677ff] text-white hover:bg-[#0958d9]'
      onClick={async () => {
        setIsExporting(true)
        try {
          const result = await reportsApi.exportReport(reportType, vesselId, year)
          notification.success('Report exported and archived to report center')
          if (result.downloadUrl && typeof window !== 'undefined') {
            window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051'}${result.downloadUrl}`, '_blank')
          }
        } catch (error) {
          notification.error(error instanceof Error ? error.message : 'Export failed')
        } finally {
          setIsExporting(false)
        }
      }}
      disabled={isExporting}
    >
      {isExporting ? 'Exporting...' : label}
    </Button>
  )
}
