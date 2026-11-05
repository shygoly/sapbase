import { MenuService } from './menu.service'

function menu(overrides: Record<string, unknown>): any {
  return {
    id: 'menu',
    label: 'Menu',
    permissions: [],
    disabled: false,
    children: [],
    parent: null,
    ...overrides,
  }
}

function serviceWith(items: unknown[]) {
  return new MenuService({
    find: async () => items,
  } as never)
}

describe('MenuService.findByPermissions', () => {
  it('keeps a permissioned leaf instead of filtering it out', async () => {
    const root = menu({ id: 'system', label: 'System', permissions: ['users:read'] })
    const leaf = menu({
      id: 'users',
      label: 'Users',
      permissions: ['users:read'],
      parent: root,
    })
    root.children = [leaf]

    const result = await serviceWith([root, leaf]).findByPermissions(['users:read'], 'org-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('system')
    expect(result[0].children?.map((child: { id: string }) => child.id)).toEqual(['users'])
  })

  it('removes permissioned leaves the user cannot access', async () => {
    const root = menu({ id: 'system', label: 'System', permissions: [] })
    const users = menu({
      id: 'users',
      label: 'Users',
      permissions: ['users:read'],
      parent: root,
    })
    const roles = menu({
      id: 'roles',
      label: 'Roles',
      permissions: ['roles:read'],
      parent: root,
    })
    root.children = [users, roles]

    const result = await serviceWith([root, users, roles]).findByPermissions(
      ['users:read'],
      'org-1',
    )

    expect(result).toHaveLength(1)
    expect(result[0].children?.map((child: { id: string }) => child.id)).toEqual(['users'])
  })

  it('keeps permission-free parents and removes empty permissioned nodes', async () => {
    const empty = menu({ id: 'empty', label: 'Empty', permissions: ['system:manage'] })
    const open = menu({ id: 'open', label: 'Open', permissions: [] })

    const result = await serviceWith([empty, open]).findByPermissions([], 'org-1')

    expect(result.map((item: { id: string }) => item.id)).toEqual(['open'])
  })

  it('filters disabled items recursively', async () => {
    const root = menu({ id: 'root', label: 'Root', permissions: [] })
    const disabled = menu({
      id: 'disabled',
      label: 'Disabled',
      permissions: [],
      disabled: true,
      parent: root,
    })
    root.children = [disabled]

    const result = await serviceWith([root, disabled]).findByPermissions([], 'org-1')

    expect(result).toHaveLength(1)
    expect(result[0].children).toEqual([])
  })
})
