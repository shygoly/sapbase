import { usersWithRole, organizationMemberIds } from './role-users'

describe('role-users 角色分配', () => {
  it('缺角色或缺租户 → 空列表（fail-closed）', async () => {
    const query = jest.fn()
    const dataSource = { query }
    expect(await usersWithRole(dataSource as never, '', 'sales-manager')).toEqual([])
    expect(await usersWithRole(dataSource as never, 'org-1', '')).toEqual([])
    expect(query).not.toHaveBeenCalled()
    expect(await organizationMemberIds(dataSource as never, '')).toEqual([])
  })

  it('权威来源是 users.role ∩ organization_members，不是请求参数', async () => {
    let capturedSql = ''
    let capturedParams: unknown[] = []
    const dataSource = {
      query: async (sql: string, params: unknown[]) => {
        capturedSql = sql
        capturedParams = params
        return [{ id: 'u-1' }]
      },
    }
    const ids = await usersWithRole(dataSource as never, 'org-1', 'sales-manager')
    expect(ids).toEqual(['u-1'])
    expect(capturedSql).toContain('FROM users u')
    expect(capturedSql).toContain('organization_members')
    expect(capturedSql).toContain('u.role')
    expect(capturedParams).toEqual(['org-1', 'sales-manager'])
  })
})
