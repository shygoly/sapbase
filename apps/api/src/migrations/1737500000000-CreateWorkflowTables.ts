import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateWorkflowTables1737500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create workflow_definitions table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_definitions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'states',
            type: 'jsonb',
          },
          {
            name: 'transitions',
            type: 'jsonb',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'draft'",
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
            default: "'1.0.0'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
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

    // Create workflow_instances table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_instances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflowDefinitionId',
            type: 'uuid',
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'entityId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'currentState',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'running'",
          },
          {
            name: 'startedById',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
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

    // Create workflow_history table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflowInstanceId',
            type: 'uuid',
          },
          {
            name: 'fromState',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'toState',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'triggeredById',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'guardResult',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'actionResult',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
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

    // Create foreign keys
    await queryRunner.createForeignKey(
      'workflow_definitions',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'workflow_instances',
      new TableForeignKey({
        columnNames: ['workflowDefinitionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workflow_definitions',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'workflow_instances',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'workflow_instances',
      new TableForeignKey({
        columnNames: ['startedById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    )

    await queryRunner.createForeignKey(
      'workflow_history',
      new TableForeignKey({
        columnNames: ['workflowInstanceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workflow_instances',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'workflow_history',
      new TableForeignKey({
        columnNames: ['triggeredById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    )

    // Create indexes
    await queryRunner.createIndex(
      'workflow_definitions',
      new TableIndex({
        name: 'idx_workflow_def_organization',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_definitions',
      new TableIndex({
        name: 'idx_workflow_def_entity_type',
        columnNames: ['entityType'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_instances',
      new TableIndex({
        name: 'idx_workflow_instance_organization',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_instances',
      new TableIndex({
        name: 'idx_workflow_instance_entity',
        columnNames: ['entityType', 'entityId'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_instances',
      new TableIndex({
        name: 'idx_workflow_instance_workflow',
        columnNames: ['workflowDefinitionId'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_history',
      new TableIndex({
        name: 'idx_workflow_history_instance',
        columnNames: ['workflowInstanceId'],
      }),
    )

    await queryRunner.createIndex(
      'workflow_history',
      new TableIndex({
        name: 'idx_workflow_history_timestamp',
        columnNames: ['timestamp'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('workflow_history', 'idx_workflow_history_timestamp')
    await queryRunner.dropIndex('workflow_history', 'idx_workflow_history_instance')
    await queryRunner.dropIndex('workflow_instances', 'idx_workflow_instance_workflow')
    await queryRunner.dropIndex('workflow_instances', 'idx_workflow_instance_entity')
    await queryRunner.dropIndex('workflow_instances', 'idx_workflow_instance_organization')
    await queryRunner.dropIndex('workflow_definitions', 'idx_workflow_def_entity_type')
    await queryRunner.dropIndex('workflow_definitions', 'idx_workflow_def_organization')

    // Drop foreign keys
    await queryRunner.dropForeignKey('workflow_history', 'FK_workflow_history_triggeredById')
    await queryRunner.dropForeignKey('workflow_history', 'FK_workflow_history_workflowInstanceId')
    await queryRunner.dropForeignKey('workflow_instances', 'FK_workflow_instances_startedById')
    await queryRunner.dropForeignKey('workflow_instances', 'FK_workflow_instances_organizationId')
    await queryRunner.dropForeignKey('workflow_instances', 'FK_workflow_instances_workflowDefinitionId')
    await queryRunner.dropForeignKey('workflow_definitions', 'FK_workflow_definitions_organizationId')

    // Drop tables
    await queryRunner.dropTable('workflow_history')
    await queryRunner.dropTable('workflow_instances')
    await queryRunner.dropTable('workflow_definitions')
  }
}
