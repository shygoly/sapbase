/**
 * Plugin Page Route
 * Dynamic route for plugin pages
 */

'use client'

import React from 'react'
import { PluginComponentRenderer } from '@/core/plugins/plugin-runtime'
import { useParams } from 'next/navigation'

export default function PluginPage() {
  const params = useParams()
  const pluginId = params?.pluginId as string
  const pageName = params?.page as string

  if (!pluginId || !pageName) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Plugin Page Not Found
          </h1>
          <p className="text-gray-600">
            Invalid plugin ID or page name
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <PluginComponentRenderer
        pluginId={pluginId}
        componentName={pageName}
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading plugin page...</p>
            </div>
          </div>
        }
      />
    </div>
  )
}
