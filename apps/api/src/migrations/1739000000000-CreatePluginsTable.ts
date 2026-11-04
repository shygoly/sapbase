import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreatePluginsTable1739000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('plugins')
    if (tableExists) {
      console.log('Table plugins already exists, skipping creation')
      return
    }

    await queryRunner.createTable(
      new Table({
        name: 'plugins',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'manifest',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'installed'",
          },
          {
            name: 'installPath',
            type: 'varchar',
            length: '500',
            isNullable: false,
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

    // Create unique index on organizationId + name
    await queryRunner.createIndex(
      'plugins',
      new TableIndex({
        name: 'IDX_plugins_organization_name',
        columnNames: ['organizationId', 'name'],
        isUnique: true,
      }),
    )

    // Create index for faster lookups
    await queryRunner.createIndex(
      'plugins',
      new TableIndex({
        name: 'IDX_plugins_organizationId',
        columnNames: ['organizationId'],
      }),
    )

    console.log('Table plugins created successfully')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('plugins')
    if (!tableExists) {
      console.log('Table plugins does not exist, skipping drop')
      return
    }

    await queryRunner.dropTable('plugins')
    console.log('Table plugins dropped successfully')
  }
}
