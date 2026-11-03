import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import * as path from 'path'

config()

const migrationsDir = path.resolve(process.cwd(), 'src', 'migrations')

const ShippingMigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'carbon',
  entities: [],
  migrations: [
    path.join(migrationsDir, '1762800000000-CreateShippingCarbonCoreTables.ts'),
    path.join(migrationsDir, '1762800001000-CreateFuelAndRegulationTables.ts'),
    path.join(migrationsDir, '1762800002000-CreateSnapshotsAndReportCenterTables.ts'),
    path.join(migrationsDir, '1762800003000-CreateAdditionalShippingFoundationTables.ts'),
    path.join(migrationsDir, '1762800004000-AlignShippingSchemaForMysqlImport.ts'),
    path.join(migrationsDir, '1762800005000-ExtendShippingChartersForMysqlImport.ts'),
  ],
  synchronize: false,
  logging: true,
  migrationsTableName: 'migrations',
})

export default ShippingMigrationDataSource
