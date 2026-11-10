'use client'

import React from 'react'
import { LayoutRuntimeAdapter } from '@sap/app-shared/layouts/layout-runtime-adapter'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <LayoutRuntimeAdapter>{children}</LayoutRuntimeAdapter>
}
