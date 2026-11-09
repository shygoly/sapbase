import { DATA_SCOPE_DDL } from './data-scope.ddl'
import { PLATFORM_CORE_ENTITIES } from '../platform-core.entities'

describe('data scope DDL', () => {
  const joined = DATA_SCOPE_DDL.join('\n')

  it('创建六张数据范围表', () => {
    for (const table of [
      'scope_dimensions',
      'scope_nodes',
      'scope_memberships',
      'scope_bindings',
      'data_policies',
      'scope_versions',
    ]) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
  })

  it('关键唯一约束/索引存在', () => {
    expect(joined).toContain('UQ_scope_dimension_org_key')
    expect(joined).toContain('UQ_scope_node_org_dimension_path')
    expect(joined).toContain('UQ_scope_binding_org_resource_dimension_kind')
    expect(joined).toContain('idx_scope_membership_org_subject')
  })

  it('实体注册包含数据范围表', () => {
    const names = PLATFORM_CORE_ENTITIES.map((entity) => entity.name)
    for (const name of [
      'ScopeDimension',
      'ScopeNode',
      'ScopeMembership',
      'ScopeBinding',
      'DataPolicy',
      'ScopeVersion',
    ]) {
      expect(names).toContain(name)
    }
  })
})
