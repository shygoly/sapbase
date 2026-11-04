import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm'
import { UserStatus } from '@speckit/shared-schemas'
import { BaseEntity } from '../common/entities/base.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  // 默认不加载；只有凭据读取路径显式取
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string

  /**
   * 直授权限（`tool:*` 之类）。**这一列不能删**：`add-chat-first-erp` C2.5 的授予路径、
   * `add-role-permission-resolution` 的「角色 ∪ 直授」并集，以及三个 e2e 都依赖它。
   * 角色权限走 `roleEntity`，两者是并集关系，不是替代关系。
   */
  @Column({ type: 'simple-array', default: '' })
  permissions: string[]

  @Column({ type: 'uuid', nullable: true })
  departmentId?: string

  @Column({ type: 'varchar', length: 50, default: UserStatus.ACTIVE })
  status: UserStatus

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({ name: 'roleId' })
  roleEntity?: Role

  @Column({ type: 'uuid', nullable: true })
  roleId?: string

  @ManyToOne(() => Department, { nullable: true, eager: true })
  @JoinColumn({ name: 'departmentId' })
  departmentEntity?: Department

  /**
   * Legacy display/auth fallback retained for databases created before the
   * normalized role entity. New authorization reads `roleEntity`, but keeping
   * the column explicit prevents `synchronize` from deleting it.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  role?: string
  roleName?: string
  rolePermissions?: string[]
}
