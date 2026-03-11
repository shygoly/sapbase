import { CreateSettingsTable1707000002000 } from './1707000002000-CreateSettingsTable'

describe('CreateSettingsTable1707000002000', () => {
  it('creates settings table referencing users table', async () => {
    const migration = new CreateSettingsTable1707000002000()
    const createTable = jest.fn()
    const hasTable = jest.fn().mockResolvedValue(false)

    await migration.up({
      createTable,
      hasTable,
    } as never)

    expect(createTable).toHaveBeenCalledTimes(1)
    const table = createTable.mock.calls[0][0]
    expect(table.name).toBe('settings')
    expect(table.foreignKeys[0].referencedTableName).toBe('users')
  })
})
