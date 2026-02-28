'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, DetailRuntime } from '@/components/runtime'
import { labApi, LabReport } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-report-detail-page',
  title: 'Report Detail',
  description: 'Generate and finalize report artifacts',
  permissions: ['lab.reports.read'],
}

const detailModel = {
  id: 'lab-report-detail',
  name: 'Report Detail',
  permissions: ['lab.reports.read'],
}

export default function LabReportDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [report, setReport] = useState<LabReport | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    if (!id) return
    const data = await labApi.getReport(id)
    setReport(data)
  }

  useEffect(() => {
    void refresh().catch(() => setReport(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const generate = async () => {
    if (!id) return
    setLoading(true)
    try {
      await labApi.generateReport(id)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const finalize = async () => {
    if (!id) return
    setLoading(true)
    try {
      await labApi.finalizeReport(id)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <DetailRuntime model={detailModel}>
        <Card>
          <CardHeader>
            <CardTitle>{report?.title ?? 'Report'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div>Status: {report?.status ?? 'N/A'}</div>
            <div>Format: {report?.format?.toUpperCase() ?? 'N/A'}</div>
            <div>Language: {report?.language ?? 'N/A'}</div>
            <div className='flex gap-2'>
              <Button onClick={generate} disabled={loading || !report || report.status !== 'draft'}>
                Generate
              </Button>
              <Button
                variant='secondary'
                onClick={finalize}
                disabled={loading || !report || report.status !== 'generated'}
              >
                Finalize
              </Button>
            </div>
          </CardContent>
        </Card>
      </DetailRuntime>
    </PageRuntime>
  )
}
