'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageRuntime, CollectionRuntime } from '@/components/runtime'
import { labApi, LabWorkflowExecution } from '@/lib/api/lab.api'

const pageModel = {
  id: 'lab-workflows-page',
  title: 'Lab Work Queue',
  description: 'Analyst workflow execution queue',
  permissions: ['lab.workflows.read'],
}

const collectionModel = {
  id: 'lab-workflows-collection',
  name: 'Workflow Queue',
  permissions: ['lab.workflows.read'],
}

export default function LabWorkflowsPage() {
  const [executions, setExecutions] = useState<LabWorkflowExecution[]>([])

  useEffect(() => {
    void labApi.listAnalystWorkQueue().then(setExecutions).catch(() => setExecutions([]))
  }, [])

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <Card>
          <CardHeader>
            <CardTitle>Work Queue ({executions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {executions.map((execution) => (
                <div key={execution.id} className='rounded border p-3 text-sm'>
                  <div className='font-medium'>Execution {execution.id.slice(0, 8)}</div>
                  <div className='text-muted-foreground'>
                    {execution.status} · Step {execution.currentStep}/{execution.plannedSteps}
                  </div>
                </div>
              ))}
              {executions.length === 0 && <div className='text-sm text-muted-foreground'>No assigned workflows</div>}
            </div>
          </CardContent>
        </Card>
      </CollectionRuntime>
    </PageRuntime>
  )
}
