'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabMethod } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-methods-page',
  title: 'Method Registry',
  description: 'Versioned laboratory method catalog',
  permissions: ['lab.methods.read'],
}

const collectionModel = {
  id: 'lab-methods-collection',
  name: 'Methods',
  permissions: ['lab.methods.read'],
}

export default function LabMethodsPage() {
  const [methods, setMethods] = useState<LabMethod[]>([])

  useEffect(() => {
    void labApi.listMethods().then(setMethods).catch(() => setMethods([]))
  }, [])

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader>
            <CardTitle>Methods ({methods.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {methods.map((method) => (
                <div key={method.id} className='rounded border p-3 text-sm'>
                  <div className='font-medium'>
                    {method.methodCode} · {method.methodName}
                  </div>
                  <div className='text-muted-foreground'>
                    {method.status} · v{method.currentVersion}
                  </div>
                </div>
              ))}
              {methods.length === 0 && <div className='text-sm text-muted-foreground'>No methods found</div>}
            </div>
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
