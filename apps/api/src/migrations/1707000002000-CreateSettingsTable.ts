import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateSettingsTable1707000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old settings table if it exists
    const tableExists = await queryRunner.hasTable('settings')
    if (tableExists) {
      await queryRunner.dropTable('settings')
    }

    // Create new settings table with user-specific fields
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'theme',
            type: 'varchar',
            length: '20',
            default: "'light'",
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'en'",
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'UTC'",
          },
          {
            name: 'date_format',
            type: 'varchar',
            length: '20',
            default: "'YYYY-MM-DD'",
          },
          {
            name: 'time_format',
            type: 'varchar',
            length: '20',
            default: "'HH:mm:ss'",
          },
          {
            name: 'page_size',
            type: 'int',
            default: 10,
          },
          {
            name: 'font_size',
            type: 'int',
            default: 14,
          },
          {
            name: 'enable_notifications',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            name: 'idx_setting_user_id',
            columnNames: ['user_id'],
            isUnique: true,
          }),
        ],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('settings')
  }
}
