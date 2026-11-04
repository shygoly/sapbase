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
    
    await MigrationDataSource.undoLastMigration()
    console.log('Last migration reverted successfully')
    
    if (MigrationDataSource.isInitialized) {
      await MigrationDataSource.destroy()
    }
    process.exit(0)
  } catch (error) {
    console.error('Migration revert error:', error)
    if (dataSource?.isInitialized) {
      await dataSource.destroy().catch(() => {})
    }
    process.exit(1)
  }
}

run()
