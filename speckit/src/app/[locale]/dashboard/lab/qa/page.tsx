'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabQaSubmission } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-qa-page',
  title: 'QA Review Queue',
  description: 'Quality review and signature staging',
  permissions: ['lab.qa.read'],
}

const collectionModel = {
  id: 'lab-qa-collection',
  name: 'QA Queue',
  permissions: ['lab.qa.read'],
}

export default function LabQaPage() {
  const [queue, setQueue] = useState<LabQaSubmission[]>([])

  useEffect(() => {
    void labApi.listQaReviewQueue().then(setQueue).catch(() => setQueue([]))
  }, [])

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader>
            <CardTitle>Pending Reviews ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {queue.map((submission) => (
                <div key={submission.id} className='rounded border p-3 text-sm'>
                  <div className='font-medium'>Submission {submission.id.slice(0, 8)}</div>
                  <div className='text-muted-foreground'>
                    {submission.status} · {new Date(submission.submittedAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {queue.length === 0 && <div className='text-sm text-muted-foreground'>No pending QA reviews</div>}
            </div>
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
