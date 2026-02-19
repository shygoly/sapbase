import { MigrationDataSource } from './data-source'

async function run() {
  let dataSource: typeof MigrationDataSource | null = null
  try {
    // Check if already initialized
    if (!MigrationDataSource.isInitialized) {
      await MigrationDataSource.initialize()
      console.log('Database connected')
    }
    dataSource = MigrationDataSource
    
    const pendingMigrations = await MigrationDataSource.showMigrations()
    console.log('Pending migrations:', pendingMigrations)
    
    await MigrationDataSource.runMigrations()
    console.log('Migrations completed successfully')
    
    if (MigrationDataSource.isInitialized) {
      await MigrationDataSource.destroy()
    }
    process.exit(0)
  } catch (error) {
    console.error('Migration error:', error)
    if (dataSource?.isInitialized) {
      await dataSource.destroy().catch(() => {})
    }
    process.exit(1)
  }
}

run()
