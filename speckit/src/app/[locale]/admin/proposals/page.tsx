'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocalePrefix } from '@/hooks/use-locale'
import { releasesApi, type ProposalView } from '@/lib/api/releases.api'

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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  submitted: 'outline',
  validating: 'outline',
  validated: 'outline',
  approved: 'default',
  published: 'default',
  rejected: 'destructive',
  withdrawn: 'secondary',
}

export default function ProposalsPage() {
  const prefix = useLocalePrefix()
  const [proposals, setProposals] = useState<ProposalView[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProposals(await releasesApi.listProposals())
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">变更提议</h1>
          <p className="text-muted-foreground text-sm">
            每一次系统变更都必须先成为提议：带证据、diff、风险、测试计划与回退计划，经他人审批后才能发布。
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
      </div>

      {message ? <div className="text-destructive text-sm">{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">提议列表</CardTitle>
          <CardDescription>按创建时间倒序，最多展示 100 条。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : proposals.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              还没有变更提议。提议可通过接口创建：POST /api/builder/proposals。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>应用</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-medium">{proposal.title}</TableCell>
                    <TableCell>{proposal.appKey}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{proposal.type ?? '-'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[proposal.status] ?? 'secondary'}>
                        {STATUS_LABEL[proposal.status] ?? proposal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('zh-CN') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={prefix(`/admin/proposals/${proposal.id}`)}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        查看详情
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
