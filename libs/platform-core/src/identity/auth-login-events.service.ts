import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuthLoginEvent } from './auth-login-event.entity'

export interface RecordLoginEventInput {
  organizationId: string
  userId?: string | null
  email: string
  provider?: string
  status: 'success' | 'failure'
  ip?: string | null
  userAgent?: string | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

@Injectable()
export class AuthLoginEventsService {
  constructor(
    @InjectRepository(AuthLoginEvent)
    private readonly repository: Repository<AuthLoginEvent>,
  ) {}

  async record(input: RecordLoginEventInput): Promise<AuthLoginEvent> {
    const row = this.repository.create({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      email: input.email,
      provider: input.provider ?? 'password',
      status: input.status,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    })
    return this.repository.save(row)
  }

  async list(
    organizationId: string,
    options: { userId?: string; limit?: number } = {},
  ): Promise<AuthLoginEvent[]> {
    return this.repository.find({
      where: options.userId
        ? { organizationId, userId: options.userId }
        : { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(200, options.limit ?? 50)),
    })
  }
}
