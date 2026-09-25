import { Entity, Column, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { AdmissionTier } from './atomic-implementation.entity'

/**
 * 模块清单导入台账 —— 哪一份清单在什么时候被谁导入过。
 *
 * 存在的理由（元语不变量 3「判定权在平台」）：
 * 清单是准入记录、不是许可；导入时 MUST 对模块字节**重算 SHA-256**，
 * 与清单声明比对后才落库。台账保存原始清单快照，便于事后追溯"当时导入的是哪一版"。
 */
@Entity('atomic_module_manifests')
@Index('idx_atomic_module_manifests_sha256', ['sha256'], { unique: true })
export class AtomicModuleManifest extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  atomicType: string

  /** 落盘文件名，形如 available-inventory-54c7674e402c.wasm */
  @Column({ type: 'varchar', length: 255 })
  file: string

  /** 重算得到的模块哈希（不是清单自述值）。 */
  @Column({ type: 'varchar', length: 64 })
  sha256: string

  @Column({ type: 'varchar', length: 2 })
  tier: AdmissionTier

  @Column({ type: 'int' })
  sizeBytes: number

  @Column({ type: 'varchar', length: 64 })
  importedBy: string

  /** 原始清单条目快照。 */
  @Column({ type: 'jsonb' })
  manifestSnapshot: Record<string, unknown>
}
