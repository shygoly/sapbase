import { EnhanceAuditLogTable1707000001000 } from './1707000001000-EnhanceAuditLogTable'

describe('EnhanceAuditLogTable1707000001000', () => {
  it('skips columns and indexes that already exist', async () => {
    const migration = new EnhanceAuditLogTable1707000001000()
    const addColumn = jest.fn()
    const createIndex = jest.fn()
    const hasColumn = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const getTable = jest
      .fn()
      .mockResolvedValueOnce({ indices: [] })
      .mockResolvedValueOnce({ indices: [{ name: 'idx_audit_log_action' }] })
      .mockResolvedValueOnce({ indices: [] })
      .mockResolvedValueOnce({ indices: [{ name: 'idx_audit_log_timestamp' }] })

    await migration.up({
      addColumn,
      createIndex,
      hasColumn,
      getTable,
    } as never)

    expect(hasColumn).toHaveBeenNthCalledWith(1, 'audit_logs', 'resource_id')
    expect(hasColumn).toHaveBeenNthCalledWith(2, 'audit_logs', 'changes')
    expect(hasColumn).toHaveBeenNthCalledWith(3, 'audit_logs', 'metadata')
    expect(addColumn).toHaveBeenCalledTimes(2)
    expect(addColumn.mock.calls.map((call) => call[1].name)).toEqual(['resource_id', 'metadata'])

    expect(getTable).toHaveBeenCalledTimes(4)
    expect(getTable).toHaveBeenNthCalledWith(1, 'audit_logs')
    expect(getTable).toHaveBeenNthCalledWith(2, 'audit_logs')
    expect(getTable).toHaveBeenNthCalledWith(3, 'audit_logs')
    expect(getTable).toHaveBeenNthCalledWith(4, 'audit_logs')
    expect(createIndex).toHaveBeenCalledTimes(2)
    expect(createIndex.mock.calls.map((call) => call[1].name)).toEqual([
      'idx_audit_log_resource_id',
      'idx_audit_log_actor',
    ])
  })
})
