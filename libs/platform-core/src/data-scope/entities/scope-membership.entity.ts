import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'
import { ScopeNode } from './scope-node.entity'

@Entity('scope_memberships')
@Index('idx_scope_membership_org_subject', ['organizationId', 'subjectType', 'subjectId'])
@Index('idx_scope_membership_org_node', ['organizationId', 'nodeId', 'positionKey'])
export class ScopeMembership extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 16 })
  subjectType: 'user' | 'role' | 'group'

  @Column({ type: 'varchar', length: 255 })
  subjectId: string

  @Column({ type: 'uuid' })
  nodeId: string

  @ManyToOne(() => ScopeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nodeId' })
  node: ScopeNode

  @Column({ type: 'varchar', length: 64 })
  positionKey: string

  @Column({ type: 'timestamptz', nullable: true })
  validFrom: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
