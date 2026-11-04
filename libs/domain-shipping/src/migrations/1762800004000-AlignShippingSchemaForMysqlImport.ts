import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

export class AlignShippingSchemaForMysqlImport1762800004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('shipping_ships', [
      new TableColumn({ name: 'shipTypeId', type: 'integer', isNullable: true }),
      new TableColumn({ name: 'gt', type: 'float', isNullable: true }),
      new TableColumn({ name: 'ciiMeasureStandard', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'ciiApplicable', type: 'boolean', isNullable: true }),
      new TableColumn({ name: 'windAssistedPropulsion', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'flagState', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'mainEnginePower', type: 'float', isNullable: true }),
      new TableColumn({ name: 'auxiliaryEnginePower', type: 'float', isNullable: true }),
      new TableColumn({ name: 'isWindPowerApplicable', type: 'boolean', isNullable: true }),
      new TableColumn({ name: 'windEquipmentInstallationTime', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'constantA', type: 'float', isNullable: true }),
      new TableColumn({ name: 'constantCapacity', type: 'float', isNullable: true }),
      new TableColumn({ name: 'constantC', type: 'float', isNullable: true }),
    ])

    await queryRunner.addColumns('shipping_voyages', [
      new TableColumn({ name: 'departurePortCode', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'arrivalPortCode', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'departureTime', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'arrivalTime', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'arrivalPurpose', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'totalEuEts', type: 'float', isNullable: true }),
      new TableColumn({ name: 'shorePowerConsumptionMj', type: 'float', isNullable: true }),
      new TableColumn({ name: 'bdnPath', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'chartererName', type: 'varchar', isNullable: true }),
    ])

    await queryRunner.addColumns('shipping_system_fuel_types', [
      new TableColumn({ name: 'co2eqWtw', type: 'float', default: 0 }),
      new TableColumn({ name: 'gwpCo2', type: 'float', default: 1 }),
      new TableColumn({ name: 'gwpCh4', type: 'float', default: 28 }),
      new TableColumn({ name: 'gwpN2o', type: 'float', default: 265 }),
    ])

    await queryRunner.addColumns('shipping_tenant_fuel_types', [
      new TableColumn({ name: 'co2eqWtw', type: 'float', default: 0 }),
      new TableColumn({ name: 'gwpCo2', type: 'float', default: 1 }),
      new TableColumn({ name: 'gwpCh4', type: 'float', default: 28 }),
      new TableColumn({ name: 'gwpN2o', type: 'float', default: 265 }),
    ])

    await queryRunner.dropIndex('shipping_cii_ship_type_parameters', 'idx_shipping_cii_ship_type_parameters_type')
    await queryRunner.addColumns('shipping_cii_ship_type_parameters', [
      new TableColumn({ name: 'applicableStandard', type: 'varchar', default: "'DWT'" }),
      new TableColumn({ name: 'rangeMin', type: 'float', default: 0 }),
      new TableColumn({ name: 'rangeMax', type: 'float', isNullable: true }),
      new TableColumn({ name: 'd1', type: 'float', default: 0.82 }),
      new TableColumn({ name: 'd2', type: 'float', default: 0.93 }),
      new TableColumn({ name: 'd3', type: 'float', default: 1.08 }),
      new TableColumn({ name: 'd4', type: 'float', default: 1.28 }),
      new TableColumn({ name: 'constantCapacity', type: 'float', isNullable: true }),
      new TableColumn({ name: 'useMax', type: 'boolean', default: false }),
    ])
    await queryRunner.createIndex(
      'shipping_cii_ship_type_parameters',
      new TableIndex({
        name: 'idx_shipping_cii_ship_type_parameters_lookup',
        columnNames: ['shipType', 'applicableStandard', 'rangeMin', 'rangeMax'],
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('shipping_cii_ship_type_parameters', 'idx_shipping_cii_ship_type_parameters_lookup')
    await queryRunner.dropColumns('shipping_cii_ship_type_parameters', [
      'applicableStandard',
      'rangeMin',
      'rangeMax',
      'd1',
      'd2',
      'd3',
      'd4',
      'constantCapacity',
      'useMax',
    ])
    await queryRunner.createIndex(
      'shipping_cii_ship_type_parameters',
      new TableIndex({
        name: 'idx_shipping_cii_ship_type_parameters_type',
        columnNames: ['shipType'],
        isUnique: true,
      }),
    )

    await queryRunner.dropColumns('shipping_tenant_fuel_types', ['co2eqWtw', 'gwpCo2', 'gwpCh4', 'gwpN2o'])
    await queryRunner.dropColumns('shipping_system_fuel_types', ['co2eqWtw', 'gwpCo2', 'gwpCh4', 'gwpN2o'])

    await queryRunner.dropColumns('shipping_voyages', [
      'departurePortCode',
      'arrivalPortCode',
      'departureTime',
      'arrivalTime',
      'arrivalPurpose',
      'totalEuEts',
      'shorePowerConsumptionMj',
      'bdnPath',
      'chartererName',
    ])

    await queryRunner.dropColumns('shipping_ships', [
      'shipTypeId',
      'gt',
      'ciiMeasureStandard',
      'ciiApplicable',
      'windAssistedPropulsion',
      'flagState',
      'mainEnginePower',
      'auxiliaryEnginePower',
      'isWindPowerApplicable',
      'windEquipmentInstallationTime',
      'constantA',
      'constantCapacity',
      'constantC',
    ])
  }
}
