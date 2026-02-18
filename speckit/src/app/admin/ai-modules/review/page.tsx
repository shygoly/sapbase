'use client'

import React, { useState, useEffect } from 'react'
import { aiModulesApi, type AIModule } from '@/lib/api/ai-modules.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import PageContainer from '@/components/layout/page-container'
import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function AIModuleReviewPage() {
  const [modules, setModules] = useState<AIModule[]>([])
  const [selectedModule, setSelectedModule] = useState<AIModule | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected' | 'pending'>('pending')
  const notification = useNotification()

  useEffect(() => {
    fetchModules()
  }, [])

  const fetchModules = async () => {
    try {
      const data = await aiModulesApi.findAll('pending_review')
      setModules(data)
    } catch (error) {
      notification.error('Failed to load modules')
    }
  }

  const handleReview = async () => {
    if (!selectedModule) return

    if (reviewDecision === 'rejected' && !rejectionReason.trim()) {
      notification.error('Rejection reason is required')
      return
    }

    try {
      await aiModulesApi.review(selectedModule.id, {
        decision: reviewDecision,
        comments: reviewComments,
        rejectionReason: rejectionReason,
      })
      notification.success(`Module ${reviewDecision}`)
      setShowReviewDialog(false)
      setSelectedModule(null)
      setReviewComments('')
      setRejectionReason('')
      setReviewDecision('pending')
      await fetchModules()
    } catch (error) {
      notification.error('Failed to submit review')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-500">
            Approved
          </Badge>
        )
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'pending_review':
        return <Badge variant="outline">Pending Review</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Module Review"
        pageDescription="Review and approve AI-generated modules"
      >
        <div className="space-y-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Test Results</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No modules pending review
                    </TableCell>
                  </TableRow>
                ) : (
                  modules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell>{getStatusBadge(module.status)}</TableCell>
                      <TableCell>{module.version}</TableCell>
                      <TableCell>
                        {module.testResults
                          ? `${module.testResults.passed}/${module.testResults.total} passed`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(module.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedModule(module)
                              setShowReviewDialog(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review Module: {selectedModule?.name}</DialogTitle>
                <DialogDescription>
                  Review the module and approve or reject it
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedModule && (
                  <>
                    <div>
                      <Label>Patch Content</Label>
                      <pre className="rounded-md bg-muted p-4 overflow-auto max-h-[300px] mt-2">
                        <code>{JSON.stringify(selectedModule.patchContent, null, 2)}</code>
                      </pre>
                    </div>

                    <div>
                      <Label>Decision</Label>
                      <div className="flex gap-4 mt-2">
                        <Button
                          variant={reviewDecision === 'approved' ? 'default' : 'outline'}
                          onClick={() => setReviewDecision('approved')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant={reviewDecision === 'rejected' ? 'destructive' : 'outline'}
                          onClick={() => setReviewDecision('rejected')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="comments">Comments</Label>
                      <Textarea
                        id="comments"
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        rows={3}
                        placeholder="Add review comments..."
                      />
                    </div>

                    {reviewDecision === 'rejected' && (
                      <div>
                        <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                        <Textarea
                          id="rejectionReason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                          placeholder="Explain why this module is being rejected..."
                          required
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReviewDialog(false)
                          setSelectedModule(null)
                          setReviewComments('')
                          setRejectionReason('')
                          setReviewDecision('pending')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleReview}>
                        Submit Review
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
