import { MigrateToSaaS1737000000000 } from './1737000000000-MigrateToSaaS'

describe('MigrateToSaaS1737000000000', () => {
  it('skips creating role unique index when it already exists', async () => {
    const migration = new MigrateToSaaS1737000000000()
    const getTable = jest.fn(async (tableName: string) => {
      if (tableName === 'roles') {
        return { columns: [{ name: 'organizationId' }], indices: [{ name: 'idx_role_organization_name' }], foreignKeys: [] }
      }

      if (tableName === 'permissions') {
        return { columns: [{ name: 'organizationId' }], indices: [], foreignKeys: [] }
      }

      if (['organization_members', 'invitations', 'organization_activities'].includes(tableName)) {
        return { columns: [{ name: 'organizationId' }], indices: [], foreignKeys: [] }
      }

      return { columns: [{ name: 'organizationId' }], indices: [], foreignKeys: [] }
    })

    const createIndex = jest.fn()
    const createForeignKey = jest.fn()
    const addColumn = jest.fn()
    const createTable = jest.fn()
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'org-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([])

    await migration.up({
      getTable,
      createIndex,
      createForeignKey,
      addColumn,
      createTable,
      query,
    } as never)

    expect(createIndex).not.toHaveBeenCalledWith(
      'roles',
      expect.objectContaining({ name: 'idx_role_organization_name' }),
    )
  })
})
