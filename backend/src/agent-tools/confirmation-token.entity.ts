import { Column, Entity } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * 写工具的一次性确认令牌。绑定 `(organizationId, tool, argsDigest)`。
 * 签发后 5 分钟内有效；消费用条件 UPDATE，影响行数 0 一律拒。
 */
@Entity('agent_confirmation_tokens')
export class AgentConfirmationToken extends TenantAwareEntity {
  @Column()
  tool: string

  @Column({ type: 'varchar', length: 64 })
  argsDigest: string

  @Column()
  actor: string

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null
}
