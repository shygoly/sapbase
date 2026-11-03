'use client'

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
import { evalApi, feedbackApi, knowledgeApi } from '@/lib/api/agent-governance.api'

interface FeedbackRow {
  id?: string
  appKey?: string
  category?: string
  role?: string
  status?: string
  contentMasked?: string
  content?: string
  releaseId?: string
  createdAt?: string
}

interface TopicRow {
  topicKey: string
  count: number
  evidence?: string[]
  roles?: string[]
}

interface KnowledgeRow {
  id: string
  knowledgeKey: string
  title: string
  scope: string
  version: number
  status: string
}

export default function AgentGovernancePage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([])
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [f, t, k] = await Promise.all([
        feedbackApi.list(),
        feedbackApi.triage(),
        knowledgeApi.published(),
      ])
      setFeedback((f ?? []) as FeedbackRow[])
      setTopics((t ?? []) as TopicRow[])
      setKnowledge((k ?? []) as KnowledgeRow[])
      setMessage(null)
    } catch (error) {
      setMessage({ kind: 'err', text: (error as Error).message })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agent 治理</h1>
          <p className="text-muted-foreground text-sm">
            业务反馈、议题聚类、已发布知识与评测集。Agent 只能起草，批准与发布必须由人完成。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            刷新
          </Button>
          <Button
            onClick={() =>
              void evalApi
                .seed()
                .then((count) => setMessage({ kind: 'ok', text: `已写入 ${count} 条黄金测试用例` }))
                .catch((error: Error) => setMessage({ kind: 'err', text: error.message }))
            }
          >
            初始化评测集
          </Button>
        </div>
      </div>

      {message ? (
        <div className={message.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">业务反馈</CardTitle>
          <CardDescription>用户在使用中提交的问题与建议（正文已脱敏）。</CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无反馈。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>应用</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>提交角色</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.appKey ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.category ?? '-'}</Badge>
                    </TableCell>
                    <TableCell>{row.role ?? '-'}</TableCell>
                    <TableCell className="max-w-[420px] truncate">
                      {row.contentMasked ?? row.content ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status ?? '-'}</Badge>
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
          <CardTitle className="text-lg">议题聚类</CardTitle>
          <CardDescription>按应用与分类聚合后的候选议题，含证据条数。</CardDescription>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无议题。反馈积累后会在这里聚类。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>议题</TableHead>
                  <TableHead>反馈数</TableHead>
                  <TableHead>涉及角色</TableHead>
                  <TableHead>证据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((topic) => (
                  <TableRow key={topic.topicKey}>
                    <TableCell className="font-medium">{topic.topicKey}</TableCell>
                    <TableCell>{topic.count}</TableCell>
                    <TableCell>{(topic.roles ?? []).join('、') || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {(topic.evidence ?? []).length} 条
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
          <CardTitle className="text-lg">已发布知识</CardTitle>
          <CardDescription>PiAgent 回答时只引用已发布版本。</CardDescription>
        </CardHeader>
        <CardContent>
          {knowledge.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无已发布知识。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>知识键</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledge.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.knowledgeKey}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.scope}</TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell>
                      <Badge>{row.status}</Badge>
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
