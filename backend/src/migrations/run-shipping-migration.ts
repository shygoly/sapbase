import ShippingMigrationDataSource from './shipping-data-source'

async function run() {
  let dataSource: typeof ShippingMigrationDataSource | null = null
  try {
    if (!ShippingMigrationDataSource.isInitialized) {
      await ShippingMigrationDataSource.initialize()
      console.log('Shipping migration database connected')
    }
    dataSource = ShippingMigrationDataSource

    const pendingMigrations = await ShippingMigrationDataSource.showMigrations()
    console.log('Shipping pending migrations:', pendingMigrations)

    await ShippingMigrationDataSource.runMigrations()
    console.log('Shipping migrations completed successfully')

    if (ShippingMigrationDataSource.isInitialized) {
      await ShippingMigrationDataSource.destroy()
    }
    process.exit(0)
  } catch (error) {
    console.error('Shipping migration error:', error)
    if (dataSource?.isInitialized) {
      await dataSource.destroy().catch(() => {})
    }
    process.exit(1)
  }
}

run()
