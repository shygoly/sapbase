'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { organizationsApi, Invitation } from '@/lib/api/organizations.api'
import { useAuthStore } from '@/core/store/auth.store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Mail, UserPlus, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function InvitationAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = (params?.token ?? '') as string
  const { isAuthenticated, user } = useAuthStore()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    loadInvitation()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when token changes
  }, [token])

  const loadInvitation = async () => {
    try {
      const data = await organizationsApi.getInvitationByToken(token)
      setInvitation(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load invitation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(`/login?returnUrl=/invitations/${token}`)
      return
    }

    setIsAccepting(true)
    try {
      await organizationsApi.acceptInvitation(token)
      toast.success('Invitation accepted successfully!')
      // Redirect to dashboard or organization page
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Invitation Not Found
            </CardTitle>
            <CardDescription>
              This invitation may have expired or been cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = invitation.status === 'expired' || invitation.status === 'cancelled'
  const isAccepted = invitation.status === 'accepted'

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Organization Invitation</CardTitle>
          <CardDescription>You&apos;ve been invited to join an organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isExpired ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Invitation Expired</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This invitation is no longer valid. Please contact the organization owner for a new
                invitation.
              </p>
            </div>
          ) : isAccepted ? (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Already Accepted</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                You have already accepted this invitation.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invited Email</p>
                    <p className="text-sm text-muted-foreground">{invitation.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Role</p>
                    <Badge variant={invitation.role === 'owner' ? 'default' : 'secondary'} className="mt-1">
                      {invitation.role}
                    </Badge>
                  </div>
                </div>
              </div>

              {!isAuthenticated ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      You need to be logged in to accept this invitation.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/login?returnUrl=/invitations/${token}`} className="flex-1">
                      <Button className="w-full">Login to Accept</Button>
                    </Link>
                    <Link href="/signup" className="flex-1">
                      <Button variant="outline" className="w-full">
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : user?.email !== invitation.email ? (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    This invitation was sent to <strong>{invitation.email}</strong>, but you are
                    logged in as <strong>{user?.email ?? 'unknown'}</strong>. Please log in with the correct
                    account.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="w-full"
                  size="lg"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
