import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { AgentDefinition } from './entities/agent-definition.entity'
import { AgentInstance } from './entities/agent-instance.entity'
import { AgentRun, type AgentRunStatus } from './entities/agent-run.entity'
import { AgentStep } from './entities/agent-step.entity'
import { AgentWait, type AgentWaitKind } from './entities/agent-wait.entity'

const ALLOWED_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: [
    'waiting_user',
    'waiting_external',
    'completed',
    'failed',
    'cancelled',
  ],
  waiting_user: ['queued', 'cancelled', 'failed'],
  waiting_external: ['queued', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
}

export interface StartRunInput {
  organizationId: string
  agentInstanceId: string
  input?: Record<string, unknown>
  budget?: Record<string, unknown>
  conversationId?: string
  releaseId?: string
  createdById?: string
}

/**
 * Durable Agent Runtime（4.1–4.4）。
 *
 * - definition/instance/session/run/step/wait 持久化；
 * - 状态迁移由服务端裁决，非法迁移拒绝；
 * - 每一步带递增 seq，事件流可 `after` 重放；
 * - 等待用户/外部输入时 run 进入 waiting_*，resume 后回到 queued。
 */
@Injectable()
export class AgentRuntimeService {
  constructor(
    @InjectRepository(AgentDefinition)
    private readonly definitions: Repository<AgentDefinition>,
    @InjectRepository(AgentInstance)
    private readonly instances: Repository<AgentInstance>,
    @InjectRepository(AgentRun)
    private readonly runs: Repository<AgentRun>,
    @InjectRepository(AgentStep)
    private readonly steps: Repository<AgentStep>,
    @InjectRepository(AgentWait)
    private readonly waits: Repository<AgentWait>,
    private readonly dataSource: DataSource,
  ) {}

  async createDefinition(input: {
    organizationId: string
    key: string
    name: string
    role: string
    version?: number
    instructions?: string | null
    policy?: Record<string, unknown>
    toolScopes?: string[]
    createdById?: string
  }): Promise<AgentDefinition> {
    if (!input.organizationId) throw new BadRequestException('缺少组织上下文')
    if (!/^[a-z][a-z0-9._-]{0,127}$/.test(input.key)) {
      throw new BadRequestException('definition key 非法')
    }
    let version = input.version
    if (version === undefined) {
      const row = await this.definitions
        .createQueryBuilder('definition')
        .select('MAX(definition.version)', 'version')
        .where('definition.organizationId = :organizationId', {
          organizationId: input.organizationId,
        })
        .andWhere('definition.key = :key', { key: input.key })
        .getRawOne<{ version: number | string | null }>()
      version = Number(row?.version ?? 0) + 1
    }
    const definition = this.definitions.create({
      organizationId: input.organizationId,
      key: input.key,
      version,
      name: input.name,
      role: input.role,
      instructions: input.instructions ?? null,
      policy: input.policy ?? {},
      toolScopes: input.toolScopes ?? [],
      status: 'draft',
      createdById: input.createdById ?? null,
    })
    return this.definitions.save(definition)
  }

  async publishDefinition(
    organizationId: string,
    id: string,
  ): Promise<AgentDefinition> {
    const definition = await this.definitions.findOne({
      where: { id, organizationId },
    })
    if (!definition) throw new NotFoundException('Agent definition 不存在')
    if (definition.status === 'published') return definition
    definition.status = 'published'
    return this.definitions.save(definition)
  }

  async listDefinitions(organizationId: string): Promise<AgentDefinition[]> {
    return this.definitions.find({
      where: { organizationId },
      order: { key: 'ASC', version: 'DESC' },
    })
  }

  async createInstance(input: {
    organizationId: string
    appKey: string
    appInstallationId?: string | null
    userId: string
    definitionId: string
    profile?: 'piagent-runtime' | 'piagent-builder'
  }): Promise<AgentInstance> {
    const definition = await this.definitions.findOne({
      where: { id: input.definitionId, organizationId: input.organizationId },
    })
    if (!definition) throw new NotFoundException('Agent definition 不存在')
    if (definition.status !== 'published') {
      throw new BadRequestException('只有 published definition 可以创建实例')
    }
    if (input.appInstallationId) {
      const rows = (await this.dataSource.query(
        `SELECT id FROM public.app_installations
          WHERE id = $1 AND "organizationId" = $2 AND status = 'active' LIMIT 1`,
        [input.appInstallationId, input.organizationId],
      )) as Array<{ id: string }>
      if (rows.length === 0) {
        throw new BadRequestException('应用安装不存在或未激活')
      }
    }
    const existing = await this.instances.findOne({
      where: {
        organizationId: input.organizationId,
        appKey: input.appKey,
        userId: input.userId,
        definitionId: input.definitionId,
      },
    })
    if (existing) return existing
    return this.instances.save(
      this.instances.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        appInstallationId: input.appInstallationId ?? null,
        userId: input.userId,
        definitionId: input.definitionId,
        profile: input.profile ?? 'piagent-runtime',
        status: 'active',
      }),
    )
  }

  async getInstance(organizationId: string, id: string): Promise<AgentInstance> {
    const instance = await this.instances.findOne({
      where: { id, organizationId },
    })
    if (!instance) throw new NotFoundException('Agent instance 不存在')
    return instance
  }

  async startRun(input: StartRunInput): Promise<AgentRun> {
    const instance = await this.getInstance(
      input.organizationId,
      input.agentInstanceId,
    )
    if (instance.status !== 'active') {
      throw new BadRequestException('Agent instance 已停用')
    }
    const run = await this.runs.save(
      this.runs.create({
        organizationId: input.organizationId,
        conversationId: input.conversationId ?? null,
        agentInstanceId: instance.id,
        definitionId: instance.definitionId,
        releaseId: input.releaseId ?? null,
        status: 'queued',
        input: input.input ?? {},
        budget: input.budget ?? {},
        createdById: input.createdById ?? null,
      }),
    )
    await this.appendEvent(input.organizationId, run.id, 'run.queued', {
      agentInstanceId: instance.id,
    })
    return this.transition(input.organizationId, run.id, 'running', {
      reason: 'start',
    })
  }

  async getRun(organizationId: string, id: string): Promise<AgentRun> {
    const run = await this.runs.findOne({ where: { id, organizationId } })
    if (!run) throw new NotFoundException('Agent run 不存在')
    return run
  }

  async transition(
    organizationId: string,
    runId: string,
    next: AgentRunStatus,
    options: { reason?: string; output?: Record<string, unknown> } = {},
  ): Promise<AgentRun> {
    const run = await this.getRun(organizationId, runId)
    const previous = run.status
    const allowed = ALLOWED_TRANSITIONS[previous] ?? []
    if (!allowed.includes(next)) {
      throw new ConflictException(
        `非法状态迁移：${previous} → ${next}（允许：${allowed.join(',') || '无'}）`,
      )
    }
    run.status = next
    if (next === 'running' && !run.startedAt) run.startedAt = new Date()
    if (['completed', 'failed', 'cancelled'].includes(next)) {
      run.finishedAt = new Date()
    }
    if (options.output) run.output = options.output
    const saved = await this.runs.save(run)
    await this.appendEvent(organizationId, run.id, `run.${next}`, {
      reason: options.reason ?? null,
      from: run.status,
    })
    return saved
  }

  async complete(
    organizationId: string,
    runId: string,
    output: Record<string, unknown> = {},
    usage: Record<string, unknown> = {},
  ): Promise<AgentRun> {
    const run = await this.getRun(organizationId, runId)
    run.usage = usage
    await this.runs.save(run)
    return this.transition(organizationId, runId, 'completed', { output })
  }

  async fail(
    organizationId: string,
    runId: string,
    error: Record<string, unknown>,
  ): Promise<AgentRun> {
    const run = await this.getRun(organizationId, runId)
    run.error = error
    await this.runs.save(run)
    return this.transition(organizationId, runId, 'failed')
  }

  async cancel(organizationId: string, runId: string): Promise<AgentRun> {
    const run = await this.transition(organizationId, runId, 'cancelled', {
      reason: 'cancelled',
    })
    await this.waits.update(
      { organizationId, runId, status: 'pending' },
      { status: 'cancelled' },
    )
    return run
  }

  async wait(
    organizationId: string,
    runId: string,
    input: {
      kind: AgentWaitKind
      prompt?: string
      payload?: Record<string, unknown>
    },
  ): Promise<{ run: AgentRun; wait: AgentWait }> {
    const next = input.kind === 'user' ? 'waiting_user' : 'waiting_external'
    const run = await this.transition(organizationId, runId, next, {
      reason: 'wait',
    })
    const wait = await this.waits.save(
      this.waits.create({
        organizationId,
        runId,
        kind: input.kind,
        status: 'pending',
        prompt: input.prompt ?? null,
        payload: input.payload ?? null,
      }),
    )
    return { run, wait }
  }

  async resume(
    organizationId: string,
    runId: string,
    resolution: Record<string, unknown> = {},
  ): Promise<{ run: AgentRun; wait: AgentWait }> {
    const wait = await this.waits.findOne({
      where: { organizationId, runId, status: 'pending' },
      order: { createdAt: 'DESC' },
    })
    if (!wait) throw new NotFoundException('没有待恢复的 wait')
    wait.status = 'resolved'
    wait.resolution = resolution
    wait.resolvedAt = new Date()
    await this.waits.save(wait)
    const run = await this.transition(organizationId, runId, 'queued', {
      reason: 'resume',
    })
    return { run, wait }
  }

  async appendEvent(
    organizationId: string,
    runId: string,
    type: string,
    payload: Record<string, unknown> = {},
    status = 'recorded',
  ): Promise<AgentStep> {
    // 单条 INSERT ... SELECT 原子分配 seq；不能另开 dataSource.transaction，
    // 否则嵌套在请求事务里会拿到另一条连接，看不到未提交的前一步。
    const rows = (await this.steps.manager.query(
      `INSERT INTO public.agent_steps
         (id, "createdAt", "updatedAt", "organizationId", "runId", seq,
          type, status, payload)
       VALUES (
         public.uuid_generate_v4(), now(), now(), $1, $2,
         (SELECT COALESCE(MAX(seq), 0) + 1
            FROM public.agent_steps WHERE "runId" = $2),
         $3, $4, $5::jsonb
       )
       RETURNING id, "createdAt", "updatedAt", "organizationId", "runId",
                 seq, type, status, payload`,
      [organizationId, runId, type, status, JSON.stringify(payload)],
    )) as Array<Record<string, unknown>>
    const row = rows[0]
    return {
      id: String(row.id),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
      organizationId: String(row.organizationId),
      runId: String(row.runId),
      seq: Number(row.seq),
      type: String(row.type),
      status: String(row.status),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    } as AgentStep
  }

  async listEvents(
    organizationId: string,
    runId: string,
    after = 0,
  ): Promise<AgentStep[]> {
    await this.getRun(organizationId, runId)
    return this.steps
      .createQueryBuilder('step')
      .where('step.organizationId = :organizationId', { organizationId })
      .andWhere('step.runId = :runId', { runId })
      .andWhere('step.seq > :after', { after })
      .orderBy('step.seq', 'ASC')
      .getMany()
  }
}
