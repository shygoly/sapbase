import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

export class EnhanceAuditLogTable1707000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to audit_logs table
    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'resource_id',
        type: 'uuid',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'changes',
        type: 'jsonb',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
      }),
    )

    // Add indexes for better query performance
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_log_resource_id',
        columnNames: ['resource_id'],
      }),
    )

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_log_action',
        columnNames: ['action'],
      }),
    )

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_log_actor',
        columnNames: ['actor'],
      }),
    )

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_log_timestamp',
        columnNames: ['timestamp'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('audit_logs', 'idx_audit_log_timestamp')
    await queryRunner.dropIndex('audit_logs', 'idx_audit_log_actor')
    await queryRunner.dropIndex('audit_logs', 'idx_audit_log_action')
    await queryRunner.dropIndex('audit_logs', 'idx_audit_log_resource_id')

    // Drop columns
    await queryRunner.dropColumn('audit_logs', 'metadata')
    await queryRunner.dropColumn('audit_logs', 'changes')
    await queryRunner.dropColumn('audit_logs', 'resource_id')
  }
}
