import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateAdditionalShippingFoundationTables1762800003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'shipping_regulation_parameters',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'year', type: 'integer' },
        { name: 'reductionRatio', type: 'float', default: 9 },
        { name: 'ghgTarget', type: 'float', default: 89 },
        { name: 'euaPriceEur', type: 'float', default: 90 },
        { name: 'excessPenaltyPerTon', type: 'float', default: 2400 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_regulation_parameters_year', columnNames: ['year'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_ship_type_parameters',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'shipType', type: 'varchar' },
        { name: 'capacityBasis', type: 'varchar', default: "'DWT'" },
        { name: 'a', type: 'float', default: 1 },
        { name: 'c', type: 'float', default: 1 },
        { name: 'd1', type: 'float', default: 0.83 },
        { name: 'd2', type: 'float', default: 0.94 },
        { name: 'd3', type: 'float', default: 1.06 },
        { name: 'd4', type: 'float', default: 1.18 },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_ship_type_parameters_type', columnNames: ['shipType'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_cii_compliant_ship_types',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'shipType', type: 'varchar' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_cii_compliant_ship_type', columnNames: ['shipType'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_gwp_values',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'gas', type: 'varchar' },
        { name: 'gwp', type: 'integer' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_gwp_values_gas', columnNames: ['gas'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_csf_values',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'gas', type: 'varchar' },
        { name: 'csf', type: 'float' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_csf_values_gas', columnNames: ['gas'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_wind_assist_factors',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'deviceType', type: 'varchar' },
        { name: 'factor', type: 'float' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_wind_assist_factors_device', columnNames: ['deviceType'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_currency_exchange_rates',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'fromCurrency', type: 'varchar', length: '3' },
        { name: 'toCurrency', type: 'varchar', length: '3' },
        { name: 'rate', type: 'float' },
        { name: 'effectiveDate', type: 'date' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_currency_exchange_rate_unique', columnNames: ['fromCurrency', 'toCurrency', 'effectiveDate'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_fuel_prices',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid', isNullable: true },
        { name: 'fuelCode', type: 'varchar' },
        { name: 'year', type: 'integer' },
        { name: 'priceUsdPerTon', type: 'float' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        new TableIndex({ name: 'idx_shipping_fuel_prices_org', columnNames: ['organizationId'] }),
        new TableIndex({ name: 'idx_shipping_fuel_prices_lookup', columnNames: ['organizationId', 'fuelCode', 'year'], isUnique: true }),
      ],
      foreignKeys: [new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_fuel_eu_ets_cf_co2',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'fuelCode', type: 'varchar' },
        { name: 'year', type: 'integer' },
        { name: 'cfCo2Ets', type: 'float' },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_fuel_eu_ets_cf_co2_lookup', columnNames: ['fuelCode', 'year'], isUnique: true })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_voyage_fuels',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'voyageId', type: 'uuid' },
        { name: 'fuelCode', type: 'varchar' },
        { name: 'consumption', type: 'float', default: 0 },
        { name: 'isMain', type: 'boolean', default: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_voyage_fuels_voyage', columnNames: ['voyageId'] })],
      foreignKeys: [new TableForeignKey({ columnNames: ['voyageId'], referencedTableName: 'shipping_voyages', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }), true)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('shipping_voyage_fuels', true)
    await queryRunner.dropTable('shipping_fuel_eu_ets_cf_co2', true)
    await queryRunner.dropTable('shipping_fuel_prices', true)
    await queryRunner.dropTable('shipping_currency_exchange_rates', true)
    await queryRunner.dropTable('shipping_wind_assist_factors', true)
    await queryRunner.dropTable('shipping_csf_values', true)
    await queryRunner.dropTable('shipping_gwp_values', true)
    await queryRunner.dropTable('shipping_cii_compliant_ship_types', true)
    await queryRunner.dropTable('shipping_ship_type_parameters', true)
    await queryRunner.dropTable('shipping_regulation_parameters', true)
  }
}
