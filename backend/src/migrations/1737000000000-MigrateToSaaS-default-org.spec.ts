import { MigrateToSaaS1737000000000 } from './1737000000000-MigrateToSaaS'

describe('MigrateToSaaS1737000000000 default organization', () => {
  it('reuses existing default organization instead of inserting duplicate slug', async () => {
    const migration = new MigrateToSaaS1737000000000()
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'existing-org' }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([])
    const getTable = jest.fn(() => ({ columns: [{ name: 'organizationId' }], indices: [], foreignKeys: [] }))

    await migration.up({
      createTable: jest.fn(),
      addColumn: jest.fn(),
      createForeignKey: jest.fn(),
      createIndex: jest.fn(),
      getTable,
      query,
    } as never)

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id FROM organizations'),
    )
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO organizations"),
    )
  })
})
