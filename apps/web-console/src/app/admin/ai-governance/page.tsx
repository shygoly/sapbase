'use client'

import React, { useState } from 'react'
import {
  aiGovernanceApi,
  type AiGateResult,
  type AiLabel,
  type AiProvenance,
  type AiScore,
} from '@sap/api-client'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sap/app-shared/components/ui/card'
import { PageRuntime, type PageModel } from '@sap/app-shared/components/runtime'
import { AiScoreValue } from '@sap/app-shared/components/ai-score-value'

const pageModel: PageModel = {
  id: 'ai-governance-admin',
  title: 'AI 内容治理',
  description: '溯源 / 标识 / 内容安全终审 / AI 参考分',
  permissions: ['ai-governance:read'],
}

export default function AiGovernancePage() {
  const [contentId, setContentId] = useState('')
  const [text, setText] = useState('')
  const [provenance, setProvenance] = useState<AiProvenance[]>([])
  const [labels, setLabels] = useState<AiLabel[]>([])
  const [gate, setGate] = useState<AiGateResult | null>(null)
  const [scores, setScores] = useState<AiScore[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      setProvenance(await aiGovernanceApi.provenance(contentId))
      setLabels(await aiGovernanceApi.labels(contentId))
      setGate(await aiGovernanceApi.gate(contentId))
      if (subjectId) {
        setScores(
          await aiGovernanceApi.listScores({ subjectType: 'student', subjectId }),
        )
      }
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载失败')
    }
  }

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await load()
    } catch (error) {
      setMessage((error as Error).message || '操作失败')
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>内容 ID</span>
            <Input value={contentId} onChange={(e) => setContentId(e.target.value)} placeholder='uuid' />
          </div>
          <Button onClick={() => void load()} disabled={!contentId}>
            查询
          </Button>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>学生 ID（评分）</span>
            <Input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
          </div>
          {message ? <span className='text-destructive text-sm'>{message}</span> : null}
        </div>

        {gate ? (
          <Card>
            <CardHeader>
              <CardTitle>发布/导出闸</CardTitle>
              <CardDescription>
                {gate.allowed ? '已满足标识 + 终审' : gate.reason}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>标识与终审</CardTitle>
            <CardDescription>显式/隐式标识缺失会阻断发布/导出</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <Button
                size='sm'
                onClick={() =>
                  void run(() =>
                    aiGovernanceApi.applyLabel({ contentId, labelType: 'explicit' }),
                  )
                }
                disabled={!contentId}
              >
                应用显式标识
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  void run(() =>
                    aiGovernanceApi.applyLabel({ contentId, labelType: 'implicit' }),
                  )
                }
                disabled={!contentId}
              >
                应用隐式标识
              </Button>
              <Input
                className='max-w-md'
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='待检测文本'
              />
              <Button
                size='sm'
                onClick={() =>
                  void run(() => aiGovernanceApi.submitReview({ contentId, text }))
                }
                disabled={!contentId || !text}
              >
                提交机器检测 + 终审链
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {labels.map((label) => (
                <Badge key={label.id} variant={label.status === 'applied' ? 'default' : 'secondary'}>
                  {label.labelType} v{label.version}: {label.text} ({label.status})
                </Badge>
              ))}
            </div>
            {provenance.length > 0 ? (
              <div className='text-muted-foreground text-sm'>
                溯源 v{provenance[0].version} · {provenance[0].producer} ·{' '}
                {provenance[0].model ?? '—'} · parent {provenance[0].parentContentId ?? '—'}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {scores.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>AI 参考分 / 教师分</CardTitle>
              <CardDescription>AI 分不能作为正式成绩，需教师确认与终审</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {scores.map((score) => (
                <div key={score.id} className='flex flex-wrap items-center gap-2 text-sm'>
                  <Badge variant='outline'>{score.status}</Badge>
                  <AiScoreValue aiScore={score.aiScore} humanScore={score.humanScore} status={score.status} />
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => void run(() => aiGovernanceApi.confirmScore(score.id, 90))}
                  >
                    教师确认 90
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => void run(() => aiGovernanceApi.appealScore(score.id, '申诉'))}
                  >
                    申诉
                  </Button>
                  <Button size='sm' onClick={() => void run(() => aiGovernanceApi.finalizeScore(score.id))}>
                    终审
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageRuntime>
  )
}
