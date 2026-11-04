import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateSnapshotsAndReportCenterTables1762800002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'shipping_report_snapshots',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'reportType', type: 'varchar' },
        { name: 'shipId', type: 'uuid', isNullable: true },
        { name: 'year', type: 'integer', isNullable: true },
        { name: 'payload', type: 'text' },
        { name: 'parameterVersion', type: 'text', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        new TableIndex({ name: 'idx_shipping_report_snapshots_org', columnNames: ['organizationId'] }),
        new TableIndex({ name: 'idx_shipping_report_snapshots_lookup', columnNames: ['organizationId', 'reportType', 'shipId', 'year'] }),
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['shipId'], referencedTableName: 'shipping_ships', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      ],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_report_center_records',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'reportType', type: 'varchar' },
        { name: 'vesselId', type: 'uuid', isNullable: true },
        { name: 'vesselName', type: 'varchar', isNullable: true },
        { name: 'year', type: 'integer', isNullable: true },
        { name: 'exportedBy', type: 'varchar', isNullable: true },
        { name: 'parameters', type: 'text', isNullable: true },
        { name: 'fileName', type: 'varchar' },
        { name: 'fileUrl', type: 'varchar', isNullable: true },
        { name: 'mimeType', type: 'varchar', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_report_center_org', columnNames: ['organizationId'] })],
      foreignKeys: [
        new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['vesselId'], referencedTableName: 'shipping_ships', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      ],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_fueleu_compliance_history',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'shipId', type: 'uuid' },
        { name: 'year', type: 'integer' },
        { name: 'isNonCompliant', type: 'boolean', default: false },
        { name: 'penaltyMultiplier', type: 'float', default: 1 },
        { name: 'note', type: 'varchar', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_fueleu_history_lookup', columnNames: ['organizationId', 'shipId', 'year'], isUnique: true })],
      foreignKeys: [
        new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['shipId'], referencedTableName: 'shipping_ships', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      ],
    }), true)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('shipping_fueleu_compliance_history', true)
    await queryRunner.dropTable('shipping_report_center_records', true)
    await queryRunner.dropTable('shipping_report_snapshots', true)
  }
}
