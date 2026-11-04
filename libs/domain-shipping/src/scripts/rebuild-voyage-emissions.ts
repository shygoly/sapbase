import { DataSource } from 'typeorm'

interface VoyageRow {
  id: string
  organizationId: string
}

interface VoyageFuelRow {
  voyageId: string
  fuelCode: string
  consumption: number
}

export function buildVoyageEmissionRows(
  voyageRows: VoyageRow[],
  fuelRows: VoyageFuelRow[],
  systemFuelFactors: Map<string, number>,
  tenantFuelFactors: Map<string, number>,
): Array<{ voyageId: string; emissions: number }> {
  const voyageById = new Map(voyageRows.map((row) => [row.id, row]))
  const emissionsByVoyageId = new Map<string, number>()

  for (const fuel of fuelRows) {
    const voyage = voyageById.get(fuel.voyageId)
    if (!voyage) {
      continue
    }
    const factor = tenantFuelFactors.get(`${voyage.organizationId}:${fuel.fuelCode}`) ?? systemFuelFactors.get(fuel.fuelCode) ?? 0
    const emissions = (emissionsByVoyageId.get(fuel.voyageId) ?? 0) + Number(fuel.consumption || 0) * factor
    emissionsByVoyageId.set(fuel.voyageId, round(emissions, 6))
  }

  return voyageRows.map((voyage) => ({
    voyageId: voyage.id,
    emissions: round(emissionsByVoyageId.get(voyage.id) ?? 0, 6),
  }))
}

export async function rebuildVoyageEmissions(): Promise<number> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'mac',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'carbon',
    entities: [],
    synchronize: false,
    logging: false,
  })

  await dataSource.initialize()
  try {
    const voyages = await dataSource.query('SELECT id, "organizationId" FROM "shipping_voyages"') as VoyageRow[]
    const voyageFuels = await dataSource.query('SELECT "voyageId", "fuelCode", consumption FROM "shipping_voyage_fuels"') as VoyageFuelRow[]
    const systemFuels = await dataSource.query('SELECT name, code, "co2Factor" FROM "shipping_system_fuel_types"') as Array<{ name: string; code: string | null; co2Factor: number }>
    const tenantFuels = await dataSource.query('SELECT "organizationId", name, code, "co2Factor" FROM "shipping_tenant_fuel_types"') as Array<{ organizationId: string; name: string; code: string | null; co2Factor: number }>

    const systemFuelFactors = new Map<string, number>()
    for (const fuel of systemFuels) {
      systemFuelFactors.set(fuel.name, Number(fuel.co2Factor || 0))
      if (fuel.code) systemFuelFactors.set(fuel.code, Number(fuel.co2Factor || 0))
    }

    const tenantFuelFactors = new Map<string, number>()
    for (const fuel of tenantFuels) {
      tenantFuelFactors.set(`${fuel.organizationId}:${fuel.name}`, Number(fuel.co2Factor || 0))
      if (fuel.code) tenantFuelFactors.set(`${fuel.organizationId}:${fuel.code}`, Number(fuel.co2Factor || 0))
    }

    const rows = buildVoyageEmissionRows(voyages, voyageFuels, systemFuelFactors, tenantFuelFactors)

    await dataSource.query('BEGIN')
    try {
      for (const row of rows) {
        await dataSource.query('UPDATE "shipping_voyages" SET emissions = $1, "updatedAt" = NOW() WHERE id = $2', [row.emissions, row.voyageId])
      }
      await dataSource.query('COMMIT')
    } catch (error) {
      await dataSource.query('ROLLBACK')
      throw error
    }

    return rows.filter((row) => row.emissions > 0).length
  } finally {
    await dataSource.destroy()
  }
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export async function main(): Promise<void> {
  const updated = await rebuildVoyageEmissions()
  process.stdout.write(`Rebuilt voyage emissions for ${updated} voyages\n`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Rebuild voyage emissions error:', error)
    process.exit(1)
  })
}
