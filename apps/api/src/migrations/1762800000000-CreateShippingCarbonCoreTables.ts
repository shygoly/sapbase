import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateShippingCarbonCoreTables1762800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'shipping_ships',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'name', type: 'varchar' },
        { name: 'imo', type: 'varchar' },
        { name: 'type', type: 'varchar' },
        { name: 'status', type: 'varchar', default: "'ACTIVE'" },
        { name: 'ciiRating', type: 'varchar', isNullable: true },
        { name: 'dwt', type: 'integer', isNullable: true },
        { name: 'speed', type: 'float', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [new TableIndex({ name: 'idx_shipping_ships_org', columnNames: ['organizationId'] })],
      foreignKeys: [new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_charters',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'shipId', type: 'uuid' },
        { name: 'charterer', type: 'varchar' },
        { name: 'startDate', type: 'date' },
        { name: 'endDate', type: 'date' },
        { name: 'status', type: 'varchar', default: "'PENDING'" },
        { name: 'allocation', type: 'varchar', isNullable: true },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        new TableIndex({ name: 'idx_shipping_charters_org', columnNames: ['organizationId'] }),
        new TableIndex({ name: 'idx_shipping_charters_ship', columnNames: ['shipId'] }),
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['shipId'], referencedTableName: 'shipping_ships', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      ],
    }), true)

    await queryRunner.createTable(new Table({
      name: 'shipping_voyages',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
        { name: 'organizationId', type: 'uuid' },
        { name: 'shipId', type: 'uuid' },
        { name: 'charterId', type: 'uuid', isNullable: true },
        { name: 'voyageNo', type: 'varchar' },
        { name: 'departurePort', type: 'varchar' },
        { name: 'arrivalPort', type: 'varchar' },
        { name: 'departureDate', type: 'date', isNullable: true },
        { name: 'arrivalDate', type: 'date', isNullable: true },
        { name: 'distanceNm', type: 'float', default: 0 },
        { name: 'emissions', type: 'float', default: 0 },
        { name: 'throughIce', type: 'boolean', default: false },
        { name: 'status', type: 'varchar', default: "'UNCLAIMED'" },
        { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        new TableIndex({ name: 'idx_shipping_voyages_org', columnNames: ['organizationId'] }),
        new TableIndex({ name: 'idx_shipping_voyages_ship', columnNames: ['shipId'] }),
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ['organizationId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['shipId'], referencedTableName: 'shipping_ships', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['charterId'], referencedTableName: 'shipping_charters', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      ],
    }), true)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('shipping_voyages', true)
    await queryRunner.dropTable('shipping_charters', true)
    await queryRunner.dropTable('shipping_ships', true)
  }
}
