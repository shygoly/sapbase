import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { AtomicContract } from './atomic-contract.entity'

/** 实现形态：平台自研 TS 跑在内核；Wasm 跑在零能力沙箱、可交付。 */
export enum AtomicImplementationKind {
  TYPESCRIPT = 'typescript',
  WASM = 'wasm',
}

/**
 * 准入层级。A = 平台自研；B = 第三方交源码、平台复现构建 + 审查。
 * **不设 Tier C** —— 不透明二进制结构性地无法入册（复现不出哈希就签不了）。
 */
export enum AdmissionTier {
  A = 'A',
  B = 'B',
}

/**
 * 准入状态机，与 `@speckit/wasm-modules` 的 `AdmissionStatus` 保持一致
 * （不另造一套状态；两份判定漂移即等于闸门失效）。
 */
export enum AdmissionStatus {
  SUBMITTED = 'submitted',
  BUILT = 'built',
  TESTED = 'tested',
  SHADOW = 'shadow',
  CANARY = 'canary',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  REVOKED = 'revoked',
}

/**
 * 原子实现 —— 契约的实现绑定。
 *
 * Wasm 实现必须能指认「客户同意跑的那一份代码」：`moduleSha256` + `abiVersion` + `tier`。
 * 注意：这一行通过 Schema 校验**不等于**模块可信 —— 宿主导入时仍须对字节重算哈希。
 */
@Entity('atomic_implementations')
@Index('idx_atomic_implementations_sha256', ['moduleSha256'])
@Index('idx_atomic_implementations_contract', ['atomicContractId'])
export class AtomicImplementation extends BaseEntity {
  @ManyToOne(() => AtomicContract, (contract) => contract.implementations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  // 关系与显式外键列共用同一列：否则 TypeORM 会按关系名再要一个 `contractId` 列，
  // 与迁移建出的 `atomicContractId` 不一致（e2e 实测踩到）。
  @JoinColumn({ name: 'atomicContractId' })
  contract: AtomicContract

  @Column({ type: 'uuid' })
  atomicContractId: string

  @Column({ type: 'varchar', length: 32 })
  kind: AtomicImplementationKind

  /** Wasm 实现必填；TS 实现为空。 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  moduleSha256: string | null

  @Column({ type: 'int', nullable: true })
  abiVersion: number | null

  @Column({ type: 'varchar', length: 2, nullable: true })
  tier: AdmissionTier | null

  /** 审查背书：reviewer / reviewedAt / reproducibleBuildRef / confidential / signature。 */
  @Column({ type: 'jsonb', nullable: true })
  review: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  reproducibleBuildRef: string | null

  /** 准入闸报告（闸 0 源码预检 / 闸 1 静态白名单），审计留痕。 */
  @Column({ type: 'jsonb', nullable: true })
  sourceGate: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  staticGate: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 32, default: AdmissionStatus.SUBMITTED })
  status: AdmissionStatus
}
