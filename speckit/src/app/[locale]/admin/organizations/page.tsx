'use client'

import { useEffect, useState } from 'react'
import { useOrganizationStore } from '@/core/store/organization.store'
import { organizationsApi, OrganizationMember, Invitation } from '@/lib/api/organizations.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, UserPlus, Trash2, Crown, User } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function OrganizationsPage() {
  const { currentOrganization, loadOrganizations, createOrganization } =
    useOrganizationStore()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'member'>('member')
  const [deleteMemberDialog, setDeleteMemberDialog] = useState<{
    open: boolean
    member: OrganizationMember | null
  }>({ open: false, member: null })

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  useEffect(() => {
    if (currentOrganization) {
      loadMembers()
      loadInvitations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when currentOrganization changes
  }, [currentOrganization])

  const loadMembers = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    try {
      const data = await organizationsApi.getMembers(currentOrganization.id)
      setMembers(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }

  const loadInvitations = async () => {
    if (!currentOrganization) return
    try {
      const data = await organizationsApi.getInvitations(currentOrganization.id)
      setInvitations(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load invitations')
    }
  }

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required')
      return
    }
    try {
      await createOrganization(newOrgName.trim())
      toast.success('Organization created successfully')
      setNewOrgName('')
      setCreateDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization')
    }
  }

  const handleInvite = async () => {
    if (!currentOrganization) return
    if (!inviteEmail.trim()) {
      toast.error('Email is required')
      return
    }
    try {
      await organizationsApi.createInvitation(currentOrganization.id, inviteEmail.trim(), inviteRole)
      toast.success('Invitation sent successfully')
      setInviteEmail('')
      setInviteRole('member')
      setInviteDialogOpen(false)
      loadInvitations()
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation')
    }
  }

  const handleRemoveMember = async () => {
    if (!currentOrganization || !deleteMemberDialog.member) return
    try {
      await organizationsApi.removeMember(
        currentOrganization.id,
        deleteMemberDialog.member.userId,
      )
      toast.success('Member removed successfully')
      setDeleteMemberDialog({ open: false, member: null })
      loadMembers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!currentOrganization) return
    try {
      await organizationsApi.cancelInvitation(currentOrganization.id, invitationId)
      toast.success('Invitation cancelled')
      loadInvitations()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation')
    }
  }

  if (!currentOrganization) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Organization Selected</CardTitle>
            <CardDescription>
              Please select an organization from the sidebar or create a new one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{currentOrganization.name}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization members and invitations
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Organization
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
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrganization}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join this organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value: 'owner' | 'member') => setInviteRole(value)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite}>Send Invitation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People who have access to this organization</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No members yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.user?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{member.user?.email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                          {member.role === 'owner' ? (
                            <>
                              <Crown className="mr-1 h-3 w-3" />
                              Owner
                            </>
                          ) : (
                            <>
                              <User className="mr-1 h-3 w-3" />
                              Member
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteMemberDialog({ open: true, member })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations waiting for acceptance</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No pending invitations</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant={invitation.role === 'owner' ? 'default' : 'secondary'}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invitation.status === 'pending'
                              ? 'default'
                              : invitation.status === 'accepted'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invitation.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={deleteMemberDialog.open}
        onOpenChange={(open: boolean) => setDeleteMemberDialog({ open, member: deleteMemberDialog.member })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteMemberDialog.member?.user?.name || 'this member'} from
              the organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
