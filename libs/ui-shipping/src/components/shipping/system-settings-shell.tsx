'use client'

import Link from 'next/link'

import { Badge } from '@sap/ui-kit/badge'
import { Button } from '@sap/ui-kit/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@sap/ui-kit/card'

interface SystemSettingsShellProps {
  title: string
  description: string
  sourceTable: string
  highlights: string[]
}

export function SystemSettingsShell({
  title,
  description,
  sourceTable,
  highlights,
}: SystemSettingsShellProps) {

  return (
    <div className='space-y-6 p-1'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='space-y-2'>
          <Badge variant='secondary'>Shipping Carbon Master Data</Badge>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
            <p className='text-sm text-muted-foreground'>{description}</p>
          </div>
        </div>
        <Button asChild variant='outline'>
          <Link href={`/dashboard/shipping/reports/home-overview`}>Back to Overview</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Scope</CardTitle>
          <CardDescription>
            This page is reserved for shipping carbon base-data maintenance and is aligned with the
            demo navigation structure.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
            <div className='font-medium'>Source table</div>
            <div className='mt-1 text-muted-foreground'>{sourceTable}</div>
          </div>
          <div className='grid gap-3 md:grid-cols-3'>
            {highlights.map((item) => (
              <div key={item} className='rounded-lg border p-4 text-sm text-muted-foreground'>
                {item}
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className='justify-between border-t text-sm text-muted-foreground'>
          <span>Menu is ready for manual verification.</span>
          <span>Data CRUD can be added on top of this shell later.</span>
        </CardFooter>
      </Card>
    </div>
  )
}
