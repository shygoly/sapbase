import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateBrandConfigsTable1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('brand_configs')
    if (tableExists) {
      console.log('Table brand_configs already exists, skipping creation')
      return
    }

    // Create brand_configs table
    await queryRunner.createTable(
      new Table({
        name: 'brand_configs',
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
            name: 'logoUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'faviconUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'theme',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customCss',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'appName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'supportEmail',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'supportUrl',
            type: 'varchar',
            length: '500',
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

    // Add foreign key constraint to organizations table
    await queryRunner.createForeignKey(
      'brand_configs',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    )

    // Create unique index on organizationId to ensure one config per organization
    await queryRunner.createIndex(
      'brand_configs',
      new TableIndex({
        name: 'IDX_brand_configs_organizationId',
        columnNames: ['organizationId'],
        isUnique: true,
      }),
    )

    // Create index for faster lookups
    await queryRunner.createIndex(
      'brand_configs',
      new TableIndex({
        name: 'IDX_brand_configs_organizationId_lookup',
        columnNames: ['organizationId'],
      }),
    )

    console.log('Table brand_configs created successfully')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists before dropping
    const tableExists = await queryRunner.hasTable('brand_configs')
    if (!tableExists) {
      console.log('Table brand_configs does not exist, skipping drop')
      return
    }

    // Drop foreign keys and indexes will be automatically dropped
    await queryRunner.dropTable('brand_configs')
    console.log('Table brand_configs dropped successfully')
  }
}
