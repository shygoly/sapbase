import { CreateAIModuleDefinitionTable1737129600000 } from './1737129600000-CreateAIModuleDefinitionTable'

describe('CreateAIModuleDefinitionTable1737129600000', () => {
  it('skips foreign key and index creation when they already exist', async () => {
    const migration = new CreateAIModuleDefinitionTable1737129600000()
    const createForeignKey = jest.fn()
    const query = jest.fn()
    const getTable = jest.fn().mockResolvedValue({
      foreignKeys: [{ columnNames: ['aiModuleId'], referencedTableName: 'ai_modules' }],
      indices: [{ name: 'IDX_ai_module_definitions_aiModuleId' }],
    })

    await migration.up({
      createTable: jest.fn(),
      createForeignKey,
      query,
      getTable,
    } as never)

    expect(createForeignKey).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('IDX_ai_module_definitions_aiModuleId'),
    )
  })
})
