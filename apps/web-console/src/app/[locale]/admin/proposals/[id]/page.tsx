'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sap/app-shared/components/ui/table'
import { releasesApi, type ProposalView } from '@sap/app-shared/lib/api/releases.api'

interface GateEvidence {
  status?: 'passed' | 'failed' | 'pending' | 'not_applicable'
  evidence?: string
  notApplicableReason?: string
  error?: string
  rule?: string
  howToFix?: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  validating: '校验中',
  validated: '校验通过',
  approved: '已批准',
  published: '已发布',
  rejected: '已驳回',
  withdrawn: '已撤回',
}

const GATE_LABEL: Record<string, string> = {
  G0: '契约校验',
  G1: '蓝图编译',
  G2: '权限变更',
  G3: '数据迁移',
  G4: '后端测试',
  G5: 'Agent 评测',
  G6: '预览冒烟',
  G7: '人工审批',
  G8: '发布',
}

function gateVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'passed') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'pending') return 'outline'
  return 'secondary'
}

function gateText(status?: string): string {
  if (status === 'passed') return '通过'
  if (status === 'failed') return '未通过'
  if (status === 'pending') return '待处理'
  return '不适用'
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [proposal, setProposal] = useState<ProposalView | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setProposal(await releasesApi.getProposal(id))
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const validate = async () => {
    setBusy(true)
    try {
      const updated = await releasesApi.validateProposal(id)
      setProposal(updated)
      setMessage(
        updated.status === 'validated'
          ? { kind: 'ok', text: '校验通过，可以进入审批' }
          : { kind: 'err', text: '校验未通过，请查看下方闸门明细' },
      )
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    setBusy(true)
    try {
      setProposal(await releasesApi.approveProposal(id, 'owner', '控制台审批通过'))
      setMessage({ kind: 'ok', text: '已批准' })
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    const reason = window.prompt('请填写驳回原因')
    if (!reason) return
    setBusy(true)
    try {
      setProposal(await releasesApi.rejectProposal(id, 'owner', reason))
      setMessage({ kind: 'ok', text: '已驳回' })
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const gates = (proposal?.risk as { gates?: Record<string, GateEvidence> } | undefined)?.gates ?? {}
  const risk = (proposal?.risk ?? {}) as Record<string, unknown>

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{proposal?.title ?? '变更提议'}</h1>
        {proposal ? (
          <Badge variant={proposal.status === 'approved' ? 'default' : 'secondary'}>
            {STATUS_LABEL[proposal.status] ?? proposal.status}
          </Badge>
        ) : null}
        {proposal?.type ? <Badge variant="outline">{proposal.type}</Badge> : null}
      </div>
      {proposal?.summary ? <p className="text-muted-foreground text-sm">{proposal.summary}</p> : null}

      {message ? (
        <div className={message.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void validate()} disabled={busy}>
          运行校验
        </Button>
        <Button variant="outline" onClick={() => void approve()} disabled={busy}>
          批准
        </Button>
        <Button variant="ghost" onClick={() => void reject()} disabled={busy}>
          驳回
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">发布闸门</CardTitle>
          <CardDescription>G0–G8 全部不失败才允许进入审批；作者不能批准自己的提议。</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(gates).length === 0 ? (
            <p className="text-muted-foreground text-sm">还没有校验记录，点击「运行校验」生成。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>闸门</TableHead>
                  <TableHead>结论</TableHead>
                  <TableHead>证据 / 原因</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(gates)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, gate]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {key} {GATE_LABEL[key] ?? ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gateVariant(gate.status)}>{gateText(gate.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[520px] text-xs">
                        {gate.error ?? gate.evidence ?? gate.notApplicableReason ?? '-'}
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
          <CardTitle className="text-lg">风险</CardTitle>
          <CardDescription>结构性风险需要第二个审批人。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            ['breaking', '破坏性变更'],
            ['permissionChange', '权限变更'],
            ['migration', '数据迁移'],
            ['agentBehaviorChange', 'Agent 行为变更'],
          ].map(([key, label]) => (
            <Badge key={key} variant={risk[key] === true ? 'destructive' : 'secondary'}>
              {label}：{risk[key] === true ? '是' : '否'}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">结构化 Diff</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/30 max-h-64 overflow-auto rounded border p-3 text-xs">
              {JSON.stringify(proposal?.diff ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">证据</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/30 max-h-64 overflow-auto rounded border p-3 text-xs">
              {JSON.stringify(proposal?.evidence ?? [], null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">测试计划</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/30 max-h-64 overflow-auto rounded border p-3 text-xs">
              {JSON.stringify(proposal?.testPlan ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">回退计划</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/30 max-h-64 overflow-auto rounded border p-3 text-xs">
              {JSON.stringify(proposal?.rollbackPlan ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
