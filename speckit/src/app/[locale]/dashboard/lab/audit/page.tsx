'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabAuditLog } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-audit-page',
  title: 'Audit Trail',
  description: 'Append-only audit logs and export',
  permissions: ['lab.audit.read'],
}

const collectionModel = {
  id: 'lab-audit-collection',
  name: 'Audit Logs',
  permissions: ['lab.audit.read'],
}

export default function LabAuditPage() {
  const [logs, setLogs] = useState<LabAuditLog[]>([])
  const [exportPreview, setExportPreview] = useState<string>('')

  const load = async () => {
    const data = await labApi.listAuditLogs()
    setLogs(data)
  }

  useEffect(() => {
    void load().catch(() => setLogs([]))
  }, [])

  const exportCsv = async () => {
    const csv = await labApi.exportAuditLogs()
    setExportPreview(csv.split('\n').slice(0, 6).join('\n'))
  }

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Audit Logs ({logs.length})</CardTitle>
            <Button variant='outline' size='sm' onClick={exportCsv}>
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-2'>
              {logs.map((log) => (
                <div key={log.id} className='rounded border p-3 text-sm'>
                  <div className='font-medium'>
                    {log.action} · {log.entityType}#{log.entityId}
                  </div>
                  <div className='text-muted-foreground'>{new Date(log.eventAt).toLocaleString()}</div>
                </div>
              ))}
              {logs.length === 0 && <div className='text-sm text-muted-foreground'>No audit logs found</div>}
            </div>
            {exportPreview && (
              <pre className='overflow-auto rounded bg-muted p-3 text-xs'>
                {exportPreview}
              </pre>
            )}
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
