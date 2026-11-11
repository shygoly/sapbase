'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Textarea } from '@sap/app-shared/components/ui/textarea'
import {
  reviewApi,
  type ReviewComment,
  type ReviewDelegation,
  type ReviewEvent,
  type ReviewStep,
} from '@sap/api-client'

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
}

const EVENT_LABELS: Record<string, string> = {
  approve: '通过',
  reject: '驳回',
  request_changes: '要求修改',
  resubmit: '重新提交',
  check: '机器检测',
}

export default function WorkItemDetailPage() {
  const params = useParams<{ id: string }>()
  const approvalId = params?.id as string
  const [step, setStep] = useState<ReviewStep | null>(null)
  const [chain, setChain] = useState<ReviewStep[]>([])
  const [delegations, setDelegations] = useState<ReviewDelegation[]>([])
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [events, setEvents] = useState<ReviewEvent[]>([])
  const [comment, setComment] = useState('')
  const [attachmentIds, setAttachmentIds] = useState('')
  const [delegateTo, setDelegateTo] = useState('')
  const [delegateReason, setDelegateReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!approvalId) return
    setLoading(true)
    try {
      const [detail, commentRows, eventRows] = await Promise.all([
        reviewApi.approval(approvalId),
        reviewApi.comments(approvalId),
        reviewApi.events(approvalId),
      ])
      setStep(detail.step)
      setChain(detail.chain)
      setDelegations(detail.delegations)
      setComments(commentRows)
      setEvents(eventRows)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载审批详情失败')
    } finally {
      setLoading(false)
    }
  }, [approvalId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (action: 'approve' | 'reject' | 'request-changes') => {
    try {
      await reviewApi.act(approvalId, action, comment || undefined)
      setComment('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '操作失败')
    }
  }

  const resubmit = async () => {
    try {
      await reviewApi.resubmit(approvalId, comment || '按意见修改后重提')
      setComment('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '重提失败')
    }
  }

  const addComment = async () => {
    try {
      await reviewApi.addComment(approvalId, {
        body: comment,
        attachmentAssetIds: attachmentIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      setComment('')
      setAttachmentIds('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '评论失败')
    }
  }

  const delegate = async () => {
    try {
      await reviewApi.delegate(approvalId, {
        toUserId: delegateTo,
        reason: delegateReason || undefined,
      })
      setDelegateTo('')
      setDelegateReason('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '委托失败')
    }
  }

  const currentRound = chain[0]?.round ?? step?.round ?? 1
  const latest = chain.filter((row) => row.round === currentRound)

  return (
    <PageContainer
      pageTitle='审批详情'
      pageDescription='轮次、步骤、评论、附件与机器检测证据；旧轮次只读。'
    >
      <div className='space-y-4'>
        <Link href='/dashboard/work-items' className='text-muted-foreground inline-flex items-center text-sm'>
          <ArrowLeft className='mr-1 h-4 w-4' />
          返回待办中心
        </Link>
        {message ? <div className='text-destructive text-sm'>{message}</div> : null}
        {loading && !step ? <Loader2 className='h-4 w-4 animate-spin' /> : null}

        {step ? (
          <>
            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>{step.entity}</Badge>
                <span className='font-medium'>{step.ruleId}</span>
                <Badge variant={step.status === 'pending' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[step.status] ?? step.status}
                </Badge>
                <Badge variant='outline'>第 {step.round} 轮 · 第 {step.stepIndex + 1} 步</Badge>
                {step.kind === 'check' ? <Badge variant='secondary'>机器检测</Badge> : null}
              </div>
              <div className='text-muted-foreground text-sm'>
                记录 {step.recordId} · 角色 {step.role || '—'} ·
                {step.dueAt ? ` 到期 ${new Date(step.dueAt).toLocaleString()}` : ' 无 SLA'}
              </div>
              {step.checkResult ? (
                <pre className='bg-muted overflow-auto rounded p-2 text-xs'>
                  {JSON.stringify(step.checkResult, null, 2)}
                </pre>
              ) : null}
            </div>

            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>当前轮次步骤</h3>
              {latest.map((row) => (
                <div key={row.id} className='flex flex-wrap items-center gap-2 text-sm'>
                  <span>#{row.stepIndex + 1}</span>
                  <Badge variant='outline'>{row.kind}</Badge>
                  <span>{row.role || '—'}</span>
                  {row.assignee ? (
                    <span className='text-muted-foreground'>
                      {String((row.assignee as { userId?: string }).userId ?? '')}
                    </span>
                  ) : null}
                  <Badge variant={row.status === 'pending' ? 'default' : 'secondary'}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </div>
              ))}
            </div>

            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>我的操作</h3>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder='审批意见 / warn 确认理由 / 重提说明'
                rows={3}
              />
              <div className='flex flex-wrap gap-2'>
                <Button onClick={() => void act('approve')}>通过</Button>
                <Button variant='destructive' onClick={() => void act('reject')}>
                  驳回
                </Button>
                <Button variant='outline' onClick={() => void act('request-changes')}>
                  要求修改
                </Button>
                <Button variant='secondary' onClick={() => void resubmit()}>
                  重新提交
                </Button>
              </div>
              <div className='flex flex-wrap items-end gap-2 pt-2'>
                <Input
                  value={attachmentIds}
                  onChange={(event) => setAttachmentIds(event.target.value)}
                  placeholder='附件 asset id（逗号分隔）'
                  className='max-w-md'
                />
                <Button variant='outline' onClick={() => void addComment()} disabled={!comment.trim()}>
                  仅评论
                </Button>
              </div>
            </div>

            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>委托</h3>
              <div className='flex flex-wrap items-end gap-2'>
                <Input
                  value={delegateTo}
                  onChange={(event) => setDelegateTo(event.target.value)}
                  placeholder='受托人 userId'
                  className='max-w-xs'
                />
                <Input
                  value={delegateReason}
                  onChange={(event) => setDelegateReason(event.target.value)}
                  placeholder='原因（可选）'
                  className='max-w-sm'
                />
                <Button onClick={() => void delegate()} disabled={!delegateTo}>
                  委托
                </Button>
              </div>
              {delegations.length > 0 ? (
                <div className='space-y-1 text-sm'>
                  {delegations.map((row) => (
                    <div key={row.id} className='flex items-center gap-2'>
                      <span>
                        {row.fromUserId} → {row.toUserId}
                      </span>
                      <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                        {row.status}
                      </Badge>
                      {row.status === 'active' ? (
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() =>
                            void reviewApi.revokeDelegation(row.id).then(() => load())
                          }
                        >
                          撤销
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>评论与附件</h3>
              {comments.map((row) => (
                <div key={row.id} className='border-b py-2 text-sm last:border-b-0'>
                  <div className='text-muted-foreground text-xs'>
                    {row.authorId ?? '系统'} · {new Date(row.createdAt).toLocaleString()}
                  </div>
                  <div>{row.body}</div>
                  {row.attachments?.length ? (
                    <div className='text-muted-foreground text-xs'>
                      附件：{row.attachments.map((item) => String(item.name ?? item.assetId)).join('、')}
                    </div>
                  ) : null}
                </div>
              ))}
              {comments.length === 0 ? (
                <div className='text-muted-foreground text-sm'>还没有评论。</div>
              ) : null}
            </div>

            <div className='space-y-2 rounded-lg border bg-card p-4'>
              <h3 className='font-medium'>事件审计</h3>
              {events.map((row) => (
                <div key={row.id} className='flex flex-wrap items-center gap-2 text-sm'>
                  <Badge variant='outline'>{EVENT_LABELS[row.type] ?? row.type}</Badge>
                  <span className='text-muted-foreground'>
                    {row.actorId ?? 'system'} · {new Date(row.createdAt).toLocaleString()}
                  </span>
                  {row.payload?.delegatedFrom ? (
                    <span className='text-muted-foreground text-xs'>
                      代决定（原审批人 {String(row.payload.delegatedFrom)}）
                    </span>
                  ) : null}
                </div>
              ))}
              {events.length === 0 ? (
                <div className='text-muted-foreground text-sm'>还没有事件。</div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </PageContainer>
  )
}
