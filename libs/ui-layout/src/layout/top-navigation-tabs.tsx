'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Button } from '@sap/ui-kit/button'
import { ScrollArea, ScrollBar } from '@sap/ui-kit/scroll-area'
import { useNavigationTabsStore } from '@sap/shared-state/core/store/navigation-tabs.store'
import { getRouteLabel, stripLocaleFromPath } from '../lib/navigation/route-display'

export function TopNavigationTabs() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const {
    tabs,
    activePath,
    hydrated,
    hydrate,
    openTab,
    activateTab,
    closeTab,
    closeOtherTabs,
  } = useNavigationTabsStore()

  const normalizedPath = stripLocaleFromPath(pathname)

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrate, hydrated])

  useEffect(() => {
    if (!normalizedPath || normalizedPath === '/') return
    openTab({
      path: normalizedPath,
      label: getRouteLabel(normalizedPath),
      closable: normalizedPath !== '/dashboard/shipping/reports/home-overview',
    })
  }, [normalizedPath, openTab])

  if (!tabs.length) return null

  return (
    <div className='border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70'>
      <ScrollArea className='w-full whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          {tabs.map((tab) => {
            const isActive = tab.path === activePath
            return (
              <div
                key={tab.path}
                className={`group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'
                }`}
              >
                <button
                  className='max-w-[180px] truncate'
                  onClick={() => {
                    activateTab(tab.path)
                    router.push(tab.path)
                  }}
                  type='button'
                >
                  {tab.label}
                </button>
                {tab.closable ? (
                  <button
                    aria-label={`Close ${tab.label}`}
                    type='button'
                    className='rounded-full p-0.5 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10'
                    onClick={() => {
                      const nextPath = closeTab(tab.path)
                      if (nextPath) router.push(nextPath)
                    }}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                ) : null}
              </div>
            )
          })}
          {tabs.length > 1 ? (
            <Button
              variant='ghost'
              size='sm'
              className='ml-2 h-8 rounded-full text-xs'
              onClick={() => closeOtherTabs(activePath)}
            >
              Close Others
            </Button>
          ) : null}
        </div>
        <ScrollBar orientation='horizontal' />
      </ScrollArea>
    </div>
  )
}
