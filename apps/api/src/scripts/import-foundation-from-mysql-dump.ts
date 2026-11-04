import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DataSource } from 'typeorm'

export interface FoundationDatasets {
  ports: Array<{ code: string; name: string; country: string | null; isEu: boolean }>
  systemFuelTypes: Array<{
    name: string
    code: string
    lcv: number
    wellToTankFactor: number
    tankToWakeFactor: number
    co2eqWtw: number
    co2Factor: number
    slipFactor: number
    gwpCo2: number
    gwpCh4: number
    gwpN2o: number
    defaultPrice: number
  }>
  tenantFuelTypes: Array<{
    organizationId: string
    name: string
    code: string
    lcv: number
    wellToTankFactor: number
    tankToWakeFactor: number
    co2eqWtw: number
    co2Factor: number
    slipFactor: number
    gwpCo2: number
    gwpCh4: number
    gwpN2o: number
    price: number
  }>
  yearParameters: Array<{ year: number; fuelEuTarget: number; etsCoverageRatio: number; euaPrice: number }>
  regulationParameters: Array<{ year: number; reductionRatio: number; ghgTarget: number; euaPriceEur: number; excessPenaltyPerTon: number }>
  ciiShipTypeParameters: Array<{
    shipType: string
    applicableStandard: string
    rangeMin: number
    rangeMax: number | null
    referenceCii: number
    requiredCii: number
    d1: number
    d2: number
    d3: number
    d4: number
    correctionFactor: number
    constantCapacity: number | null
    useMax: boolean
  }>
  gwpValues: Array<{ gas: string; gwp: number }>
  csfValues: Array<{ gas: string; csf: number }>
  fuelPrices: Array<{ organizationId: string | null; fuelCode: string; year: number; priceUsdPerTon: number }>
  fuelEuEtsCfCo2: Array<{ fuelCode: string; year: number; cfCo2Ets: number }>
}

interface ImportOptions {
  defaultOrganizationId?: string
  organizationIdByTenantId?: Record<string, string>
}

interface MysqlRow {
  [key: string]: string | number | null
}

const FOUNDATION_TABLES = ['annual_configuration', 'fuel_type', 'cii_config', 'eu_port', 'ship_type'] as const

export function buildFoundationDatasets(sql: string, options: ImportOptions = {}): FoundationDatasets {
  const annualConfigurations = parseTableRows(sql, 'annual_configuration')
  const fuelTypes = parseTableRows(sql, 'fuel_type')
  const ciiConfigs = parseTableRows(sql, 'cii_config')
  const ports = parseTableRows(sql, 'eu_port')
  const shipTypes = parseTableRows(sql, 'ship_type')
  const shipTypeMap = new Map(shipTypes.map((row) => [String(row.id), String(row.ship_type_code)]))

  const yearParameters = annualConfigurations.map((row) => ({
    year: toNumber(row.config_year),
    fuelEuTarget: toNumber(row.ghg_intensity_target),
    etsCoverageRatio: inferEtsCoverageRatio(toNumber(row.config_year)),
    euaPrice: toNumber(row.eua_price),
  }))

  const regulationParameters = annualConfigurations.map((row) => ({
    year: toNumber(row.config_year),
    reductionRatio: toNumber(row.cii_reduction_rate),
    ghgTarget: toNumber(row.ghg_intensity_target),
    euaPriceEur: toNumber(row.eua_price),
    excessPenaltyPerTon: toNumber(row.fuel_eu_penalty),
  }))

  const systemFuelTypes = fuelTypes
    .filter((row) => toNumber(row.tenant_id) === 1)
    .map((row) => ({
      name: String(row.fuel),
      code: String(row.fuel),
      lcv: toNumber(row.lcv),
      wellToTankFactor: toNumber(row.co2eq_wtt),
      tankToWakeFactor: deriveTankToWakeFactor(row),
      co2eqWtw: toNumber(row.co2eq_wtw),
      co2Factor: toNumber(row.cf_co2),
      slipFactor: toNumber(row.cslip),
      gwpCo2: toNumber(row.gwp_co2),
      gwpCh4: toNumber(row.gwp_ch4),
      gwpN2o: toNumber(row.gwp_n2o),
      defaultPrice: toNumber(row.price),
    }))

  const tenantFuelTypes = fuelTypes
    .filter((row) => toNumber(row.tenant_id) !== 1)
    .map((row) => {
      const organizationId = resolveOrganizationId(row.tenant_id, options)
      if (!organizationId) {
        return null
      }

      return {
        organizationId,
        name: String(row.fuel),
        code: String(row.fuel),
        lcv: toNumber(row.lcv),
        wellToTankFactor: toNumber(row.co2eq_wtt),
        tankToWakeFactor: deriveTankToWakeFactor(row),
        co2eqWtw: toNumber(row.co2eq_wtw),
        co2Factor: toNumber(row.cf_co2),
        slipFactor: toNumber(row.cslip),
        gwpCo2: toNumber(row.gwp_co2),
        gwpCh4: toNumber(row.gwp_ch4),
        gwpN2o: toNumber(row.gwp_n2o),
        price: toNumber(row.price),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const fuelPrices = fuelTypes
    .filter((row) => row.year !== null && row.price !== null)
    .map((row) => ({
      organizationId: toNumber(row.tenant_id) === 1 ? null : resolveOrganizationId(row.tenant_id, options),
      fuelCode: String(row.fuel),
      year: toNumber(row.year),
      priceUsdPerTon: toNumber(row.price),
    }))

  const fuelEuEtsCfCo2 = fuelTypes
    .filter((row) => row.year !== null && row.cf_co2eq !== null)
    .map((row) => ({
      fuelCode: String(row.fuel),
      year: toNumber(row.year),
      cfCo2Ets: toNumber(row.cf_co2eq),
    }))

  const defaultFuel = fuelTypes[0]
  const gwpValues = defaultFuel
    ? [
        { gas: 'CO2', gwp: toNumber(defaultFuel.gwp_co2) },
        { gas: 'CH4', gwp: toNumber(defaultFuel.gwp_ch4) },
        { gas: 'N2O', gwp: toNumber(defaultFuel.gwp_n2o) },
      ]
    : []

  const csfValues = defaultFuel
    ? [
        { gas: 'CO2', csf: toNumber(defaultFuel.csf_co2) },
        { gas: 'CH4', csf: toNumber(defaultFuel.csf_ch4) },
        { gas: 'N2O', csf: toNumber(defaultFuel.csf_n2o) },
      ]
    : []

  const ciiShipTypeParameters = ciiConfigs.map((row) => ({
    shipType: shipTypeMap.get(String(row.ship_type_id)) ?? `TYPE_${String(row.ship_type_id)}`,
    applicableStandard: String(row.applicable_standard),
    rangeMin: toNumber(row.range_min),
    rangeMax: row.range_max === null ? null : toNumber(row.range_max),
    referenceCii: toNumber(row.constant_a),
    requiredCii: toNumber(row.constant_c),
    d1: toNumber(row.d1),
    d2: toNumber(row.d2),
    d3: toNumber(row.d3),
    d4: toNumber(row.d4),
    correctionFactor: 1,
    constantCapacity: row.constant_capacity === null ? null : toNumber(row.constant_capacity),
    useMax: toBoolean(row.use_max),
  }))

  const mappedPorts = ports.map((row) => {
    const code = String(row.port_code)
    return {
      code,
      name: code,
      country: code.length >= 2 ? code.slice(0, 2) : null,
      isEu: true,
    }
  })

  return {
    ports: dedupeBy(mappedPorts, (item) => item.code),
    systemFuelTypes: dedupeBy(systemFuelTypes, (item) => item.name),
    tenantFuelTypes: dedupeBy(tenantFuelTypes, (item) => `${item.organizationId}:${item.name}`),
    yearParameters: dedupeBy(yearParameters, (item) => String(item.year)),
    regulationParameters: dedupeBy(regulationParameters, (item) => String(item.year)),
    ciiShipTypeParameters: dedupeBy(
      ciiShipTypeParameters,
      (item) => `${item.shipType}:${item.applicableStandard}:${item.rangeMin}:${item.rangeMax ?? 'null'}`,
    ),
    gwpValues,
    csfValues,
    fuelPrices: dedupeBy(
      fuelPrices,
      (item) => `${item.organizationId ?? 'null'}:${item.fuelCode}:${item.year}`,
    ),
    fuelEuEtsCfCo2: dedupeBy(
      fuelEuEtsCfCo2,
      (item) => `${item.fuelCode}:${item.year}`,
    ),
  }
}

export async function importFoundationDatasets(
  dataSource: DataSource,
  datasets: FoundationDatasets,
): Promise<void> {
  await replaceTableContents(dataSource, 'shipping_ports', datasets.ports)
  await replaceTableContents(dataSource, 'shipping_system_fuel_types', datasets.systemFuelTypes)
  await replaceTableContents(dataSource, 'shipping_tenant_fuel_types', datasets.tenantFuelTypes)
  await replaceTableContents(dataSource, 'shipping_year_parameters', datasets.yearParameters)
  await replaceTableContents(dataSource, 'shipping_regulation_parameters', datasets.regulationParameters)
  await replaceTableContents(dataSource, 'shipping_cii_ship_type_parameters', datasets.ciiShipTypeParameters)
  await replaceTableContents(dataSource, 'shipping_gwp_values', datasets.gwpValues)
  await replaceTableContents(dataSource, 'shipping_csf_values', datasets.csfValues)
  await replaceTableContents(dataSource, 'shipping_fuel_prices', datasets.fuelPrices)
  await replaceTableContents(dataSource, 'shipping_fuel_eu_ets_cf_co2', datasets.fuelEuEtsCfCo2)
}

export async function importFoundationFromMysqlDump(
  sqlPath: string,
  options: ImportOptions = {},
): Promise<FoundationDatasets> {
  const sql = readFileSync(sqlPath, 'utf8')
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
    const organizationIdByTenantId = options.organizationIdByTenantId ?? await ensureOrganizationsForTenantIds(dataSource, extractFuelTenantIds(sql))
    const datasets = buildFoundationDatasets(sql, {
      ...options,
      organizationIdByTenantId,
    })
    await importFoundationDatasets(dataSource, datasets)
    return datasets
  } finally {
    await dataSource.destroy()
  }
}

async function replaceTableContents<T extends Record<string, unknown>>(
  dataSource: DataSource,
  tableName: string,
  rows: T[],
): Promise<void> {
  await dataSource.query(`DELETE FROM "${tableName}"`)

  if (rows.length === 0) {
    return
  }

  const chunkSize = 1000
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const columns = Object.keys(chunk[0])
    const values: unknown[] = []
    const valueGroups = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column] ?? null)
        return `$${rowIndex * columns.length + columnIndex + 1}`
      })
      return `(${placeholders.join(', ')})`
    })

    await dataSource.query(
      `INSERT INTO "${tableName}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES ${valueGroups.join(', ')}`,
      values,
    )
  }
}

function parseTableRows(sql: string, tableName: (typeof FOUNDATION_TABLES)[number] | string): MysqlRow[] {
  const columns = parseCreateColumns(sql, tableName)
  if (columns.length === 0) {
    return []
  }

  const insertRegex = new RegExp("INSERT INTO \\`" + escapeRegExp(tableName) + "\\` VALUES \\((.*)\\);", 'g')
  const rows: MysqlRow[] = []
  let match: RegExpExecArray | null

  while ((match = insertRegex.exec(sql)) !== null) {
    const values = splitSqlValues(match[1])
    const row = Object.fromEntries(columns.map((column, index) => [column, parseSqlValue(values[index] ?? 'NULL')]))
    rows.push(row)
  }

  return rows
}

function parseCreateColumns(sql: string, tableName: string): string[] {
  const createRegex = new RegExp("CREATE TABLE \\`" + escapeRegExp(tableName) + "\\`\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE", 'm')
  const createMatch = sql.match(createRegex)
  if (!createMatch) {
    return []
  }

  return createMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('`'))
    .map((line) => line.match(/^`([^`]+)`/)?.[1])
    .filter((column): column is string => Boolean(column))
}

function splitSqlValues(input: string): string[] {
  const values: string[] = []
  let current = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (char === "'") {
      current += char
      inString = !inString
      continue
    }

    if (char === ',' && !inString) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.length > 0) {
    values.push(current.trim())
  }

  return values
}

function parseSqlValue(rawValue: string): string | number | null {
  const normalized = rawValue.trim()
  if (normalized === 'NULL') {
    return null
  }

  if (normalized.startsWith("'") && normalized.endsWith("'")) {
    return normalized.slice(1, -1).replace(/\\'/g, "'")
  }

  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? normalized : numeric
}

function deriveTankToWakeFactor(row: MysqlRow): number {
  const lcv = toNumber(row.lcv)
  const co2Factor = toNumber(row.cf_co2)
  const cfCh4 = toNumber(row.cf_ch4)
  const cfN2o = toNumber(row.cf_n2o)
  const gwpCh4 = toNumber(row.gwp_ch4)
  const gwpN2o = toNumber(row.gwp_n2o)

  if (lcv > 0 && (co2Factor > 0 || cfCh4 > 0 || cfN2o > 0)) {
    return (co2Factor + (cfCh4 * gwpCh4) + (cfN2o * gwpN2o)) / lcv
  }

  return toNumber(row.co2eq_ttw)
}

function toNumber(value: string | number | null): number {
  if (typeof value === 'number') {
    return value
  }
  if (value === null || value === '') {
    return 0
  }
  return Number(value)
}

function toBoolean(value: string | number | null): boolean {
  if (typeof value === 'number') {
    return value === 1
  }
  return value === '1' || value === 'true'
}

function resolveOrganizationId(
  tenantIdValue: string | number | null,
  options: ImportOptions,
): string | null {
  const tenantId = String(tenantIdValue ?? '').trim()
  if (!tenantId || tenantId === '1') {
    return null
  }

  return options.organizationIdByTenantId?.[tenantId] ?? options.defaultOrganizationId ?? null
}

function extractFuelTenantIds(sql: string): string[] {
  return [...new Set(parseTableRows(sql, 'fuel_type').map((row) => String(row.tenant_id ?? '').trim()).filter((tenantId) => tenantId && tenantId !== '1'))]
}

async function ensureOrganizationsForTenantIds(
  dataSource: DataSource,
  tenantIds: string[],
): Promise<Record<string, string>> {
  const organizationIdByTenantId: Record<string, string> = {}

  for (const tenantId of tenantIds) {
    const slug = `legacy-tenant-${tenantId}`
    const existing = await dataSource.query(
      'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
      [slug],
    )

    if (existing[0]?.id) {
      organizationIdByTenantId[tenantId] = existing[0].id as string
      continue
    }

    const inserted = await dataSource.query(
      'INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING id',
      [`Legacy Tenant ${tenantId}`, slug, 'active'],
    )
    organizationIdByTenantId[tenantId] = inserted[0].id as string
  }

  return organizationIdByTenantId
}

function inferEtsCoverageRatio(year: number): number {
  if (year <= 2024) return 0.4
  if (year === 2025) return 0.7
  return 1
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    map.set(getKey(item), item)
  }
  return [...map.values()]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function main(): Promise<void> {
  const sqlPath = process.argv[2] ?? resolve(process.cwd(), '../../tests/route_carbon_analyzer_backup.sql')
  const organizationId = process.argv[3] || process.env.DEFAULT_ORGANIZATION_ID
  const datasets = await importFoundationFromMysqlDump(sqlPath, {
    defaultOrganizationId: organizationId,
  })

  process.stdout.write(
    `Imported foundation datasets: ports=${datasets.ports.length}, fuels=${datasets.systemFuelTypes.length}, years=${datasets.yearParameters.length}, cii=${datasets.ciiShipTypeParameters.length}\n`,
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Foundation import error:', error)
    process.exit(1)
  })
}
