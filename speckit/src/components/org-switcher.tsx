'use client'

import { useEffect } from 'react'
import { Building2, Plus } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useOrganizationStore } from '@/core/store/organization.store'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { toast } from 'sonner'

export function OrgSwitcher() {
  useRouter()
  const {
    currentOrganization,
    organizations,
    isLoading,
    loadOrganizations,
    switchOrganization,
    createOrganization,
  } = useOrganizationStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === currentOrganization?.id) return
    try {
      await switchOrganization(organizationId)
      toast.success('Organization switched successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch organization')
    }
  }

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required')
      return
    }
    setIsCreating(true)
    try {
      await createOrganization(newOrgName.trim())
      toast.success('Organization created successfully')
      setNewOrgName('')
      setCreateDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2">
          <Select
            value={currentOrganization?.id || ''}
            onValueChange={handleSwitch}
            disabled={isLoading || organizations.length === 0}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <SelectValue placeholder="Select organization">
                  {currentOrganization ? (
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {currentOrganization.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {currentOrganization.planName || 'Free Plan'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No organization</span>
                  )}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {org.planName || 'Free Plan'}
                    </span>
                  </div>
                </SelectItem>
              ))}
              <div className="border-t pt-2 mt-2">
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCreateDialogOpen(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Organization
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Organization</DialogTitle>
                      <DialogDescription>
                        Create a new organization to manage your team and resources.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                          id="org-name"
                          placeholder="Enter organization name"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCreateOrganization()
                            }
                          }}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateDialogOpen(false)
                          setNewOrgName('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateOrganization} disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </SelectContent>
          </Select>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
