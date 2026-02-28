'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabReport } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-reports-page',
  title: 'Reports',
  description: 'Report lifecycle and generation queue',
  permissions: ['lab.reports.read'],
}

const collectionModel = {
  id: 'lab-reports-collection',
  name: 'Reports',
  permissions: ['lab.reports.read'],
}

export default function LabReportsPage() {
  const [reports, setReports] = useState<LabReport[]>([])

  useEffect(() => {
    void labApi.listReports().then(setReports).catch(() => setReports([]))
  }, [])

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader>
            <CardTitle>Reports ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {reports.map((report) => (
                <div key={report.id} className='flex items-center justify-between rounded border p-3 text-sm'>
                  <div>
                    <div className='font-medium'>{report.title}</div>
                    <div className='text-muted-foreground'>
                      {report.status} · {report.format.toUpperCase()} · {report.language}
                    </div>
                  </div>
                  <Button asChild size='sm' variant='outline'>
                    <Link href={`/dashboard/lab/reports/${report.id}`}>Detail</Link>
                  </Button>
                </div>
              ))}
              {reports.length === 0 && <div className='text-sm text-muted-foreground'>No reports found</div>}
            </div>
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
