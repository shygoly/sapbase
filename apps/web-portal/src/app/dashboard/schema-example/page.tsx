'use client'

import React from 'react'
import { PageRuntime, useRuntimeSchema } from '@sap/ui-runtime/runtime'
import { SchemaList } from '@sap/ui-runtime/components/schema-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/ui-kit/card'
import { Badge } from '@sap/ui-kit/badge'

/**
 * Example page: resolves /specs/pages/customers.json through the Schema system
 * and renders it inside PageRuntime. Mirrors what a generated page would consume.
 */
export default function SchemaExamplePage() {
  const { schema, loading, error } = useRuntimeSchema('customers')

  return (
    <PageRuntime
      model={{
        id: 'schema-example',
        title: 'Schema example',
        description: 'Page resolved from public/specs via SchemaResolver, rendered inside PageRuntime.',
      }}
      isLoading={loading}
    >
      {error ? (
        <div className='text-destructive text-sm'>Failed to resolve schema: {error}</div>
      ) : !schema ? (
        <div className='text-muted-foreground text-sm'>No schema resolved.</div>
      ) : (
        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                {schema.metadata?.title ?? schema.path}
                <Badge variant='outline'>{schema.type}</Badge>
              </CardTitle>
              <CardDescription>{schema.path}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='rounded-md border'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b text-left'>
                      <th className='px-3 py-2 font-medium'>Field</th>
                      <th className='px-3 py-2 font-medium'>Type</th>
                      <th className='px-3 py-2 font-medium'>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.fields.map((field) => (
                      <tr key={field.name} className='border-b last:border-0'>
                        <td className='px-3 py-2'>{field.label}</td>
                        <td className='px-3 py-2 font-mono text-xs'>{field.type}</td>
                        <td className='px-3 py-2'>{field.required ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>SchemaList preview</CardTitle>
              <CardDescription>Same schema, rendered through SchemaList with local sample rows.</CardDescription>
            </CardHeader>
            <CardContent>
              <SchemaList
                schema={{
                  name: schema.path,
                  label: schema.metadata?.title ?? schema.path,
                  version: '1',
                  fields: schema.fields,
                }}
                data={[
                  { name: '山禾制造', email: 'ops@shanhe.example', phone: '021-0000', company: '山禾', industry: 'manufacturing', status: 'active' },
                  { name: '远洋物流', email: 'it@ocean.example', phone: '021-1111', company: '远洋', industry: 'logistics', status: 'active' },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Permission rules</CardTitle>
              <CardDescription>Merged from page, view and object schemas.</CardDescription>
            </CardHeader>
            <CardContent>
              {schema.permissions.length === 0 ? (
                <p className='text-muted-foreground text-sm'>No permission rules declared.</p>
              ) : (
                <ul className='space-y-1 text-sm'>
                  {schema.permissions.map((rule, index) => (
                    <li key={`${rule.field}:${rule.action}:${index}`} className='font-mono text-xs'>
                      {rule.field}:{rule.action} → {rule.permissions.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageRuntime>
  )
}
