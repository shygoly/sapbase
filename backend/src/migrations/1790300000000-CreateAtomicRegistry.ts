import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm'

/**
 * 原子契约注册表（change: add-wasm-atomic-runtime / Phase 1）。
 *
 * 三张表对应 design.md 的数据模型：
 *   atomic_contracts          原子契约（能力定义，与实现解耦）
 *   atomic_implementations    实现绑定（TS 或 Wasm，含准入证据）
 *   atomic_module_manifests   清单导入台账（含重算后的哈希）
 *
 * 迁移一旦提交不改写（backend/AGENTS.md）：后续变更用新迁移。
 */
export class CreateAtomicRegistry1790300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('atomic_contracts')) {
      console.log('Table atomic_contracts already exists, skipping creation')
      return
    }

    // ── 1. 原子契约 ────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'atomic_contracts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'atomicType', type: 'varchar', length: '64', isNullable: false },
          { name: 'version', type: 'varchar', length: '32', isNullable: false },
          { name: 'kind', type: 'varchar', length: '32', isNullable: false },
          { name: 'description', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'draft'",
          },
          { name: 'inputSchema', type: 'jsonb', isNullable: false },
          { name: 'outputSchema', type: 'jsonb', isNullable: false },
          { name: 'permissions', type: 'jsonb', default: "'[]'::jsonb" },
          { name: 'errors', type: 'jsonb', default: "'[]'::jsonb" },
          {
            name: 'idempotency',
            type: 'varchar',
            length: '32',
            default: "'none'",
          },
          { name: 'organizationId', type: 'uuid', isNullable: true },
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

    // 同一 atomicType 下版本唯一（契约版本化共存的前提）
    await queryRunner.createIndex(
      'atomic_contracts',
      new TableIndex({
        name: 'idx_atomic_contracts_type_version',
        columnNames: ['atomicType', 'version'],
        isUnique: true,
      }),
    )

    await queryRunner.createIndex(
      'atomic_contracts',
      new TableIndex({
        name: 'idx_atomic_contracts_organization',
        columnNames: ['organizationId'],
      }),
    )

    // ── 2. 原子实现 ────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'atomic_implementations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'atomicContractId', type: 'uuid', isNullable: false },
          { name: 'kind', type: 'varchar', length: '32', isNullable: false },
          { name: 'moduleSha256', type: 'varchar', length: '64', isNullable: true },
          { name: 'abiVersion', type: 'int', isNullable: true },
          { name: 'tier', type: 'varchar', length: '2', isNullable: true },
          { name: 'review', type: 'jsonb', isNullable: true },
          {
            name: 'reproducibleBuildRef',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'sourceGate', type: 'jsonb', isNullable: true },
          { name: 'staticGate', type: 'jsonb', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'submitted'",
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

    await queryRunner.createForeignKey(
      'atomic_implementations',
      new TableForeignKey({
        columnNames: ['atomicContractId'],
        referencedTableName: 'atomic_contracts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createIndex(
      'atomic_implementations',
      new TableIndex({
        name: 'idx_atomic_implementations_sha256',
        columnNames: ['moduleSha256'],
      }),
    )

    await queryRunner.createIndex(
      'atomic_implementations',
      new TableIndex({
        name: 'idx_atomic_implementations_contract',
        columnNames: ['atomicContractId'],
      }),
    )

    // ── 3. 清单导入台账 ────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'atomic_module_manifests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'atomicType', type: 'varchar', length: '128', isNullable: false },
          { name: 'file', type: 'varchar', length: '255', isNullable: false },
          { name: 'sha256', type: 'varchar', length: '64', isNullable: false },
          { name: 'tier', type: 'varchar', length: '2', isNullable: false },
          { name: 'sizeBytes', type: 'int', isNullable: false },
          { name: 'importedBy', type: 'varchar', length: '64', isNullable: false },
          { name: 'manifestSnapshot', type: 'jsonb', isNullable: false },
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

    // 同一模块哈希只登记一次（导入幂等的依据）
    await queryRunner.createIndex(
      'atomic_module_manifests',
      new TableIndex({
        name: 'idx_atomic_module_manifests_sha256',
        columnNames: ['sha256'],
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('atomic_module_manifests', true)
    await queryRunner.dropTable('atomic_implementations', true)
    await queryRunner.dropTable('atomic_contracts', true)
  }
}
