'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import {
  integrationsApi,
  type DataSource,
  type IntegrationConnector,
  type OutboundMessage,
  type SyncJob,
  type SyncRun,
} from '@sap/api-client'

function variant(status: string) {
  if (['succeeded', 'processed', 'active', 'ok'].includes(status)) return 'default' as const
  if (['failed', 'dead', 'disabled'].includes(status)) return 'destructive' as const
  return 'secondary' as const
}

export default function IntegrationsPage() {
  const [connectors, setConnectors] = useState<IntegrationConnector[]>([])
  const [outbound, setOutbound] = useState<OutboundMessage[]>([])
  const [sources, setSources] = useState<DataSource[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof integrationsApi.metrics>> | null>(null)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'rest' | 'webhook' | 'database'>('rest')
  const [config, setConfig] = useState('{\n  "endpoint": "https://example.com/webhook",\n  "allowlist": ["example.com"]\n}')
  const [secretRef, setSecretRef] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [connectorList, outboundList, sourceList, jobList, runList, metricData] =
        await Promise.all([
          integrationsApi.connectors(),
          integrationsApi.outbound(),
          integrationsApi.dataSources(),
          integrationsApi.syncJobs(),
          integrationsApi.syncRuns(),
          integrationsApi.metrics(),
        ])
      setConnectors(connectorList)
      setOutbound(outboundList)
      setSources(sourceList)
      setJobs(jobList)
      setRuns(runList)
      setMetrics(metricData)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载集成失败')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createConnector = async () => {
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>
      await integrationsApi.createConnector({
        key,
        name: name || key,
        type,
        config: parsed,
        secretRef: secretRef || undefined,
      })
      setMessage('连接器已创建')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '创建失败')
    }
  }

  return (
    <PageContainer
      pageTitle='外部集成'
      pageDescription='连接器 / 出站消息 / Webhook / 只读数据源同步 / DLQ / 对账指标。'
    >
      <div className='space-y-4'>
        <div className='grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>key</span>
            <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder='crm-rest' />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>type</span>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='rest'>REST</SelectItem>
                <SelectItem value='webhook'>Webhook</SelectItem>
                <SelectItem value='database'>Database</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>secretRef（env:NAME）</span>
            <Input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} />
          </div>
          <div className='space-y-1 md:col-span-3'>
            <span className='text-xs text-muted-foreground'>config JSON</span>
            <textarea
              className='min-h-24 w-full rounded border bg-background p-2 font-mono text-xs'
              value={config}
              onChange={(event) => setConfig(event.target.value)}
            />
          </div>
          <div className='flex items-end'>
            <Button disabled={!key} onClick={() => void createConnector()}>创建连接器</Button>
          </div>
        </div>
        {message ? <p className='text-muted-foreground text-sm'>{message}</p> : null}

        {metrics ? (
          <div className='flex flex-wrap gap-4 rounded-lg border bg-card p-4 text-sm'>
            <span>出站：{metrics.outbound.succeeded}/{metrics.outbound.total} 成功</span>
            <span>DLQ：{metrics.outbound.dead}</span>
            <span>同步读：{metrics.sync.rowsRead}</span>
            <span>写：{metrics.sync.rowsWritten}</span>
            <span>失败：{metrics.sync.rowsFailed}</span>
          </div>
        ) : null}

        <div className='grid gap-4 lg:grid-cols-2'>
          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>连接器</h3>
            {connectors.map((connector) => (
              <div key={connector.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
                <Badge variant={variant(connector.status)}>{connector.status}</Badge>
                <span className='font-mono text-xs'>{connector.key}</span>
                <span>{connector.type}</span>
                <span className='text-muted-foreground'>v{connector.version}</span>
                <Button size='sm' variant='outline' onClick={() => void integrationsApi.testConnector(connector.id).then(load)}>
                  测试
                </Button>
                <Button size='sm' variant='destructive' onClick={() => void integrationsApi.disableConnector(connector.id).then(load)}>
                  停用
                </Button>
              </div>
            ))}
            {connectors.length === 0 ? <p className='text-muted-foreground text-sm'>暂无连接器</p> : null}
          </section>

          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>出站消息 / DLQ</h3>
            {outbound.map((item) => (
              <div key={item.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
                <Badge variant={variant(item.status)}>{item.status}</Badge>
                <span>{item.eventType}</span>
                <span className='text-muted-foreground'>attempts {item.attempts}</span>
                {item.status === 'dead' ? (
                  <Button size='sm' variant='secondary' onClick={() => void integrationsApi.replayOutbound(item.id).then(load)}>
                    重放
                  </Button>
                ) : null}
                {item.lastError ? <span className='text-destructive text-xs'>{item.lastError}</span> : null}
              </div>
            ))}
            {outbound.length === 0 ? <p className='text-muted-foreground text-sm'>暂无消息</p> : null}
          </section>

          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>数据源 / 同步任务</h3>
            {sources.map((source) => (
              <div key={source.id} className='rounded border p-2 text-sm'>
                <div className='flex items-center gap-2'>
                  <Badge variant={variant(source.status)}>{source.status}</Badge>
                  <span className='font-mono text-xs'>{source.key}</span>
                  <span>{source.host}/{source.database}</span>
                  <Button size='sm' variant='outline' onClick={() => void integrationsApi.testDataSource(source.id).then(load)}>
                    测试
                  </Button>
                </div>
              </div>
            ))}
            {jobs.map((job) => (
              <div key={job.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
                <span className='font-mono text-xs'>{job.key}</span>
                <span>{job.targetResourceKey}</span>
                <span className='text-muted-foreground'>watermark {job.watermark ?? '-'}</span>
                <Button size='sm' onClick={() => void integrationsApi.runSyncJob(job.id).then(load)}>运行</Button>
              </div>
            ))}
          </section>

          <section className='space-y-2 rounded-lg border bg-card p-4'>
            <h3 className='font-medium'>同步运行 / 差异</h3>
            {runs.map((run) => (
              <div key={run.id} className='rounded border p-2 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant={variant(run.status)}>{run.status}</Badge>
                  <span>读 {run.rowsRead}</span>
                  <span>写 {run.rowsWritten}</span>
                  <span>失败 {run.rowsFailed}</span>
                </div>
                {run.diff ? (
                  <p className='text-muted-foreground text-xs'>diff: {JSON.stringify(run.diff)}</p>
                ) : null}
                {run.error ? <p className='text-destructive text-xs'>{run.error}</p> : null}
              </div>
            ))}
            {runs.length === 0 ? <p className='text-muted-foreground text-sm'>暂无运行</p> : null}
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
