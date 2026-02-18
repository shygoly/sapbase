import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import * as path from 'path'

config()

export const MigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [],
  migrations: [
    path.join(__dirname, '1737000000000-MigrateToSaaS.ts'),
    path.join(__dirname, '1737500000000-CreateWorkflowTables.ts'),
  ],
  synchronize: false,
  logging: true,
  migrationsTableName: 'migrations',
})
