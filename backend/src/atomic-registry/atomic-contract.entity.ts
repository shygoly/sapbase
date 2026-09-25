import { Entity, Column, Index, OneToMany, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Organization } from '../organizations/organization.entity'
import { AtomicImplementation } from './atomic-implementation.entity'

/** 原子类型：v1 只允许计算型与查询型。写入型需事务与补偿设计，另立变更。 */
export enum AtomicKind {
  CALCULATION = 'calculation',
  QUERY = 'query',
}

export enum AtomicContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

/**
 * 原子契约 —— 一个最小业务能力的接口与约束。
 *
 * 权威定义是仓库根 `schemas/atomic-contract.schema.json`；本实体是它在库里的落地形态。
 * 字段一旦迁移到数据库就难改，因此**先冻结 Schema 再建表**（见 change 的 Phase 0）。
 *
 * 租户语义：`organizationId = null` 表示平台内置契约（所有租户可见）；
 * 非空表示组织自建。故这里继承 BaseEntity 而非 TenantAwareEntity
 * （后者要求 organizationId 非空）。
 */
@Entity('atomic_contracts')
@Index('idx_atomic_contracts_type_version', ['atomicType', 'version'], {
  unique: true,
})
@Index('idx_atomic_contracts_organization', ['organizationId'])
export class AtomicContract extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  atomicType: string

  @Column({ type: 'varchar', length: 32 })
  version: string

  @Column({ type: 'varchar', length: 32 })
  kind: AtomicKind

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null

  @Column({
    type: 'varchar',
    length: 32,
    default: AtomicContractStatus.DRAFT,
  })
  status: AtomicContractStatus

  /** 输入投影：只含整数列，标识类字段不进入模块（见 ABI v1）。 */
  @Column({ type: 'jsonb' })
  inputSchema: Record<string, unknown>

  /** 输出布局与上限。 */
  @Column({ type: 'jsonb' })
  outputSchema: Record<string, unknown>

  /** 调用该原子所需的权限点，复用现有 RBAC。 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  permissions: string[]

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  errors: string[]

  @Column({ type: 'varchar', length: 32, default: 'none' })
  idempotency: 'none' | 'requestId'

  /** 可选执行预算（fuel 单位）：声明后引擎按此计量并中断。 */
  @Column({ type: 'bigint', nullable: true })
  cpuBudget: string | null

  @ManyToOne(() => Organization, { nullable: true })
  organization: Organization | null

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @OneToMany(
    () => AtomicImplementation,
    (implementation) => implementation.contract,
  )
  implementations: AtomicImplementation[]
}
