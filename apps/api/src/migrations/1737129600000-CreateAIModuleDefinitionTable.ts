import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateAIModuleDefinitionTable1737129600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_module_definitions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'aiModuleId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'step1_objectModel',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'step2_relationships',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'step3_stateFlow',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'step4_pages',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'step5_permissions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'step6_reports',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'mergedDefinition',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'ai_module_definitions',
      new TableForeignKey({
        columnNames: ['aiModuleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ai_modules',
        onDelete: 'CASCADE',
      }),
    )

    // Create index on aiModuleId for faster lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_module_definitions_aiModuleId" ON "ai_module_definitions" ("aiModuleId")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ai_module_definitions')
  }
}
