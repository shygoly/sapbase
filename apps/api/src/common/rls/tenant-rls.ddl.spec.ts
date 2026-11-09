import { TENANT_RLS_DDL, TENANT_RLS_TABLE_COUNT } from './tenant-rls.ddl'

describe('tenant RLS DDL', () => {
  const joined = TENANT_RLS_DDL.join('\n')

  it('覆盖直接租户表、子表与原子能力父子表', () => {
    expect(TENANT_RLS_TABLE_COUNT).toBeGreaterThan(30)
    for (const table of [
      'blueprint_records',
      'audit_logs',
      'app_installations',
      'app_installation_revisions',
      'agent_confirmation_tokens',
      'outbox_events',
      'scope_dimensions',
      'scope_nodes',
      'scope_memberships',
      'scope_bindings',
      'data_policies',
      'scope_versions',
    ]) {
      expect(joined).toContain(`to_regclass('public.${table}') IS NOT NULL`)
      expect(joined).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
    expect(joined).toContain('tenant_parent_isolation ON public.module_capabilities')
    expect(joined).toContain('atomic_contracts_read')
  })

  it('读写都使用事务内设置的组织上下文', () => {
    expect(joined).toContain('public.current_organization_id()')
    expect(joined.match(/WITH CHECK/g)?.length).toBeGreaterThan(30)
    expect(joined).toContain(`current_setting('app.organization_id', true)`)
  })

  it('子表策略不伪造第二份租户判定', () => {
    expect(joined).toContain('SELECT 1 FROM public.module_registry p')
    expect(joined).toContain('WHERE p.id::text = "moduleId"::text')
    expect(joined).not.toContain('public.module_capabilities."moduleId"')
  })
})
