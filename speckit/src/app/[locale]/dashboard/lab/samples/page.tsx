'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabSample } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-samples-page',
  title: 'Lab Samples',
  description: 'Sample intake and lifecycle management',
  permissions: ['lab.samples.read'],
}

const collectionModel = {
  id: 'lab-samples-collection',
  name: 'Lab Samples',
  permissions: ['lab.samples.read'],
}

export default function LabSamplesPage() {
  const [samples, setSamples] = useState<LabSample[]>([])

  useEffect(() => {
    void labApi.listSamples().then(setSamples).catch(() => setSamples([]))
  }, [])

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader>
            <CardTitle>Samples ({samples.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {samples.map((sample) => (
                <div key={sample.id} className='rounded border p-3 text-sm'>
                  <div className='font-medium'>{sample.sampleCode}</div>
                  <div className='text-muted-foreground'>
                    {sample.sampleType || 'N/A'} · {sample.status} · Qty {sample.quantity}
                  </div>
                </div>
              ))}
              {samples.length === 0 && <div className='text-sm text-muted-foreground'>No samples found</div>}
            </div>
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
