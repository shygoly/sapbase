import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateFuelAndRegulationTables1762800001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'shipping_ports',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'code', type: 'varchar' },
        { name: 'name', type: 'varchar' },
        { name: 'country', type: 'varchar', isNullable: true },
        { name: 'isEu', type: 'boolean', default: false },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_ports_code', columnNames: ['code'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_system_fuel_types',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'name', type: 'varchar' },
        { name: 'code', type: 'varchar', isNullable: true },
        { name: 'lcv', type: 'float', default: 0 },
        { name: 'wellToTankFactor', type: 'float', default: 0 },
        { name: 'tankToWakeFactor', type: 'float', default: 0 },
        { name: 'co2Factor', type: 'float', default: 0 },
        { name: 'slipFactor', type: 'float', default: 0 },
        { name: 'defaultPrice', type: 'float', default: 0 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_system_fuel_types_name', columnNames: ['name'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_tenant_fuel_types',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'name', type: 'varchar' },
        { name: 'code', type: 'varchar', isNullable: true },
        { name: 'lcv', type: 'float', default: 0 },
        { name: 'wellToTankFactor', type: 'float', default: 0 },
        { name: 'tankToWakeFactor', type: 'float', default: 0 },
        { name: 'co2Factor', type: 'float', default: 0 },
        { name: 'slipFactor', type: 'float', default: 0 },
        { name: 'price', type: 'float', default: 0 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_tenant_fuel_types_lookup', columnNames: ['organizationId', 'name'], isUnique: true })],
      foreignKeys: [new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_year_parameters',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'year', type: 'integer' },
        { name: 'fuelEuTarget', type: 'float', default: 89 },
        { name: 'etsCoverageRatio', type: 'float', default: 0.7 },
        { name: 'euaPrice', type: 'float', default: 0.09 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_year_parameters_year', columnNames: ['year'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_cii_ship_type_parameters',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'shipType', type: 'varchar' },
        { name: 'referenceCii', type: 'float', default: 4.8 },
        { name: 'requiredCii', type: 'float', default: 4.5 },
        { name: 'correctionFactor', type: 'float', default: 1 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_cii_ship_type_parameters_type', columnNames: ['shipType'], isUnique: true })],
    }), true)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('shipping_cii_ship_type_parameters', true)
    await queryRunner.dropTable('shipping_year_parameters', true)
    await queryRunner.dropTable('shipping_tenant_fuel_types', true)
    await queryRunner.dropTable('shipping_system_fuel_types', true)
    await queryRunner.dropTable('shipping_ports', true)
  }
}
