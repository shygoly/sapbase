import { DataSource } from 'typeorm'
import { runInTransaction } from 'typeorm-transactional'

const SET_CONTEXT_SQL = `
  SELECT
    set_config('app.organization_id', $1, true),
    set_config('app.app_installation_id', $2, true),
    set_config('app.user_id', $3, true)
`

export interface TenantTransactionContext {
  organizationId?: string
  appInstallationId?: string
  userId?: string
}

/**
 * Runs work in one transaction with transaction-local RLS context.
 *
 * Callers outside HTTP must provide the tenant explicitly. Do not introduce a
 * global platform bypass: jobs should fan out per organization.
 */
export async function withTenantContext<T>(
  dataSource: DataSource,
  context: TenantTransactionContext,
  work: () => Promise<T>,
): Promise<T> {
  return runInTransaction(async () => {
    await dataSource.query(SET_CONTEXT_SQL, [
      context.organizationId ?? '',
      context.appInstallationId ?? '',
      context.userId ?? '',
    ])
    return work()
  })
}
