'use client'

import { useEffect } from 'react'
import { Boxes } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useBusinessAppStore } from '@/core/store/business-app.store'
import { useOrganizationStore } from '@/core/store/organization.store'

export function AppSwitcher() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const {
    currentApplication,
    applications,
    isLoading,
    loadApplications,
    switchApplication,
  } = useBusinessAppStore()
  const activeApplications = applications.filter((item) => item.status === 'active')

  useEffect(() => {
    if (currentOrganization?.id) {
      void loadApplications()
    }
  }, [currentOrganization?.id, loadApplications])

  if (!currentOrganization) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Select
          value={currentApplication?.id || ''}
          onValueChange={switchApplication}
          disabled={isLoading || activeApplications.length === 0}
        >
          <SelectTrigger className='w-full'>
            <div className='flex items-center gap-2'>
              <div className='bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
                <Boxes className='size-4' />
              </div>
              <SelectValue placeholder='Select application'>
                {currentApplication ? (
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-medium'>
                      {currentApplication.displayName}
                    </span>
                    <span className='text-muted-foreground truncate text-xs'>
                      {currentApplication.blueprintVersion}
                    </span>
                  </div>
                ) : (
                  <span className='text-muted-foreground'>
                    {isLoading ? 'Loading applications...' : 'No application installed'}
                  </span>
                )}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            {activeApplications.map((application) => (
              <SelectItem key={application.id} value={application.id}>
                <div className='flex flex-col'>
                  <span className='font-medium'>{application.displayName}</span>
                  <span className='text-muted-foreground text-xs'>
                    {application.appKey} · {application.blueprintVersion}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
