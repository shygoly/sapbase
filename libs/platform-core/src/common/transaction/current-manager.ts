import type { DataSource, EntityManager } from 'typeorm'

/**
 * 返回当前异步调用链里已开启的 TypeORM 事务 manager（若有）。
 *
 * typeorm-transactional 会 patch `DataSource.manager`：事务上下文内返回带
 * queryRunner 的 manager。复用它可避免 HTTP 租户事务内再开第二个事务，
 * 导致连接池自锁（外层持连接等内层连接）。
 */
export function currentTransactionManager(dataSource: DataSource): EntityManager | null {
  try {
    const manager = dataSource.manager as EntityManager | undefined
    return manager?.queryRunner ? manager : null
  } catch {
    return null
  }
}
