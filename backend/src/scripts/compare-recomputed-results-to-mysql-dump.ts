import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { DataSource } from 'typeorm'
import { calculateCiiReport } from '../shipping-carbon/domain/services/cii-engine.service'
import { calculateEtsReport } from '../shipping-carbon/domain/services/ets-engine.service'
import { calculateFuelEuReport } from '../shipping-carbon/domain/services/fueleu-engine.service'

interface MysqlRow {
  [key: string]: string | number | null
}

interface MysqlShipRef {
  tenantId: string
  shipId: string
  shipName: string
  imo: string
}

interface MysqlCiiExpected extends MysqlShipRef {
  year: number
  attainedCii: number | null
  requiredCii: number | null
  rating: string | null
}

interface MysqlEtsExpected extends MysqlShipRef {
  year: number
  ytdEmissions: number
  ytdEuaRequired: number
  forecastEuaRequired: number | null
}

interface MysqlFuelEuExpected extends MysqlShipRef {
  year: number
  ghgActual: number | null
  totalPenalty: number | null
}

interface MetricDiff {
  expected: number | null
  actual: number | null
  delta: number | null
  status: 'match' | 'diff' | 'missing_expected' | 'missing_actual'
}

interface CompareRow {
  framework: 'cii' | 'eu-ets' | 'fueleu'
  tenantId: string
  year: number
  shipName: string
  imo: string
  organizationSlug: string | null
  status: 'matched' | 'mismatch' | 'missing_pg_ship' | 'missing_pg_voyages' | 'missing_source_voyages'
  details: Record<string, MetricDiff | string | null>
}

interface MysqlExpectedResults {
  cii: Map<string, MysqlCiiExpected>
  ets: Map<string, MysqlEtsExpected>
  fuelEu: Map<string, MysqlFuelEuExpected>
  voyagePresence: Set<string>
}

export function aggregateMysqlExpectedResults(sql: string): MysqlExpectedResults {
  const shipRows = parseTableRows(sql, 'ship_info')
  const voyageRows = parseTableRows(sql, 'ship_voyage')
  const ciiRows = parseTableRows(sql, 'cii_evaluation_detail')
  const etsRows = parseTableRows(sql, 'eu_ets_detail')
  const fuelEuRows = parseTableRows(sql, 'fuel_eu_calculation_result')

  const ships = new Map<string, MysqlShipRef>()
  for (const row of shipRows) {
    const tenantId = normalizeString(row.tenant_id) ?? '1'
    const shipId = normalizeString(row.id) ?? ''
    ships.set(`${tenantId}:${shipId}`, {
      tenantId,
      shipId,
      shipName: normalizeString(row.ship_name) ?? '',
      imo: normalizeString(row.imo_number) ?? '',
    })
  }

  const voyageYearByKey = new Map<string, number>()
  const voyagePresence = new Set<string>()
  for (const row of voyageRows) {
    const tenantId = normalizeString(row.tenant_id) ?? '1'
    const voyageId = normalizeString(row.id) ?? ''
    const shipId = normalizeString(row.ship_id) ?? ''
    const departureTime = normalizeString(row.departure_time)
    const year = departureTime ? Number(departureTime.slice(0, 4)) : 0
    voyageYearByKey.set(`${tenantId}:${voyageId}`, year)
    if (shipId && year) {
      voyagePresence.add(`${tenantId}:${shipId}:${year}`)
    }
  }

  const cii = new Map<string, MysqlCiiExpected>()
  for (const row of ciiRows) {
    const tenantId = normalizeString(row.tenant_id) ?? '1'
    const shipId = normalizeString(row.ship_id) ?? ''
    const year = toNumber(row.year)
    const ship = ships.get(`${tenantId}:${shipId}`)
    if (!ship) continue
    cii.set(`${tenantId}:${shipId}:${year}`, {
      ...ship,
      year,
      attainedCii: nullableNumber(row.emission_value),
      requiredCii: nullableNumber(row.cii_required),
      rating: normalizeString(row.rating),
    })
  }

  const etsAgg = new Map<string, MysqlEtsExpected>()
  for (const row of etsRows) {
    const tenantId = normalizeString(row.tenant_id) ?? '1'
    const shipId = normalizeString(row.ship_id) ?? ''
    const voyageId = normalizeString(row.voyage_id) ?? ''
    const year = voyageYearByKey.get(`${tenantId}:${voyageId}`) ?? 0
    if (!year) continue
    const ship = ships.get(`${tenantId}:${shipId}`)
    if (!ship) continue
    const key = `${tenantId}:${shipId}:${year}`
    const current = etsAgg.get(key) ?? {
      ...ship,
      year,
      ytdEmissions: 0,
      ytdEuaRequired: 0,
      forecastEuaRequired: 0,
    }
    const coveredEmissionTons = toNumber(row.emission_value) / 1_000_000
    current.ytdEmissions = round(current.ytdEmissions + coveredEmissionTons, 4)
    current.ytdEuaRequired = round(current.ytdEuaRequired + coveredEmissionTons, 4)
    current.forecastEuaRequired = round((current.forecastEuaRequired ?? 0) + (row.forecast_value === null ? 0 : toNumber(row.forecast_value) / 1_000_000), 4)
    etsAgg.set(key, current)
  }

  const fuelEu = new Map<string, MysqlFuelEuExpected>()
  for (const row of fuelEuRows) {
    const tenantId = normalizeString(row.tenant_id) ?? '1'
    const shipId = normalizeString(row.ship_id) ?? ''
    const year = toNumber(row.assessment_year)
    const ship = ships.get(`${tenantId}:${shipId}`)
    if (!ship) continue
    fuelEu.set(`${tenantId}:${shipId}:${year}`, {
      ...ship,
      year,
      ghgActual: nullableNumber(row.ghg_actual_value),
      totalPenalty: nullableNumber(row.total_penalty_amount),
    })
  }

  return { cii, ets: etsAgg, fuelEu, voyagePresence }
}

export function buildMetricDiff(expected: number | null, actual: number | null, tolerance = 0.01): MetricDiff {
  if (expected === null || expected === undefined) {
    return { expected: null, actual, delta: null, status: 'missing_expected' }
  }
  if (actual === null || actual === undefined) {
    return { expected, actual: null, delta: null, status: 'missing_actual' }
  }
  const delta = round(actual - expected, 4)
  return {
    expected,
    actual,
    delta,
    status: Math.abs(delta) <= tolerance ? 'match' : 'diff',
  }
}

async function compareAgainstPg(sql: string): Promise<CompareRow[]> {
  const mysql = aggregateMysqlExpectedResults(sql)
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
    const organizations = await dataSource.query('SELECT id, slug FROM organizations') as Array<{ id: string; slug: string }>
    const orgIdBySlug = new Map(organizations.map((row) => [row.slug, row.id]))
    const ships = await dataSource.query('SELECT id, imo, name, "organizationId" FROM "shipping_ships"') as Array<{ id: string; imo: string; name: string; organizationId: string }>
    const pgShipByOrgAndImo = new Map(ships.map((row) => [`${row.organizationId}:${row.imo}`, row]))

    const rows: CompareRow[] = []
    rows.push(...await compareCii(dataSource, mysql.cii, mysql.voyagePresence, orgIdBySlug, pgShipByOrgAndImo))
    rows.push(...await compareEts(dataSource, mysql.ets, mysql.voyagePresence, orgIdBySlug, pgShipByOrgAndImo))
    rows.push(...await compareFuelEu(dataSource, mysql.fuelEu, mysql.voyagePresence, orgIdBySlug, pgShipByOrgAndImo))
    return rows
  } finally {
    await dataSource.destroy()
  }
}

async function compareCii(
  dataSource: DataSource,
  expectedMap: Map<string, MysqlCiiExpected>,
  voyagePresence: Set<string>,
  orgIdBySlug: Map<string, string>,
  pgShipByOrgAndImo: Map<string, { id: string; imo: string; name: string; organizationId: string }>,
): Promise<CompareRow[]> {
  const rows: CompareRow[] = []
  for (const expected of expectedMap.values()) {
    const organizationSlug = tenantIdToOrgSlug(expected.tenantId)
    const organizationId = organizationSlug ? orgIdBySlug.get(organizationSlug) ?? null : null
    if (!organizationId) {
      rows.push(buildMissingShipRow('cii', expected, organizationSlug))
      continue
    }
    const ship = pgShipByOrgAndImo.get(`${organizationId}:${expected.imo}`)
    if (!ship) {
      rows.push(buildMissingShipRow('cii', expected, organizationSlug))
      continue
    }
    const voyages = await fetchPgVoyages(dataSource, ship.id, organizationId, expected.year)
    if (voyages.length === 0) {
      rows.push(buildMissingVoyagesRow('cii', expected, organizationSlug, voyagePresence.has(`${expected.tenantId}:${expected.shipId}:${expected.year}`)))
      continue
    }
    const ciiContext = await fetchPgCiiContext(dataSource, ship.id, organizationId, expected.year)
    const actual = calculateCiiReport(
      voyages.map((voyage) => ({
        ...voyage,
        ciiCapacity: ciiContext?.capacity ?? undefined,
        referenceCii: ciiContext?.referenceCii ?? undefined,
        requiredCii: ciiContext?.requiredCii ?? undefined,
        ciiD1: ciiContext?.d1 ?? undefined,
        ciiD2: ciiContext?.d2 ?? undefined,
        ciiD3: ciiContext?.d3 ?? undefined,
        ciiD4: ciiContext?.d4 ?? undefined,
      })),
    )
    const ratingMatches = (expected.rating ?? null) === actual.metrics.rating
    const attained = buildMetricDiff(expected.attainedCii, actual.metrics.attainedCii, 0.01)
    const required = buildMetricDiff(expected.requiredCii, actual.metrics.requiredCii, 0.01)
    rows.push({
      framework: 'cii',
      tenantId: expected.tenantId,
      year: expected.year,
      shipName: expected.shipName,
      imo: expected.imo,
      organizationSlug,
      status: attained.status === 'match' && required.status === 'match' && ratingMatches ? 'matched' : 'mismatch',
      details: {
        mysqlRating: expected.rating,
        pgRating: actual.metrics.rating,
        attainedCii: attained,
        requiredCii: required,
      },
    })
  }
  return rows
}

async function compareEts(
  dataSource: DataSource,
  expectedMap: Map<string, MysqlEtsExpected>,
  voyagePresence: Set<string>,
  orgIdBySlug: Map<string, string>,
  pgShipByOrgAndImo: Map<string, { id: string; imo: string; name: string; organizationId: string }>,
): Promise<CompareRow[]> {
  const rows: CompareRow[] = []
  for (const expected of expectedMap.values()) {
    const organizationSlug = tenantIdToOrgSlug(expected.tenantId)
    const organizationId = organizationSlug ? orgIdBySlug.get(organizationSlug) ?? null : null
    if (!organizationId) {
      rows.push(buildMissingShipRow('eu-ets', expected, organizationSlug))
      continue
    }
    const ship = pgShipByOrgAndImo.get(`${organizationId}:${expected.imo}`)
    if (!ship) {
      rows.push(buildMissingShipRow('eu-ets', expected, organizationSlug))
      continue
    }
    const voyages = await fetchPgVoyages(dataSource, ship.id, organizationId, expected.year)
    if (voyages.length === 0) {
      rows.push(buildMissingVoyagesRow('eu-ets', expected, organizationSlug, voyagePresence.has(`${expected.tenantId}:${expected.shipId}:${expected.year}`)))
      continue
    }
    const actual = calculateEtsReport(voyages)
    const ytdEmissions = buildMetricDiff(expected.ytdEmissions, actual.metrics.ytdEmissions, 0.01)
    const ytdEuaRequired = buildMetricDiff(expected.ytdEuaRequired, actual.metrics.ytdEuaRequired, 0.01)
    const forecastEuaRequired = buildMetricDiff(expected.forecastEuaRequired, actual.metrics.forecastEuaRequired, 0.01)
    rows.push({
      framework: 'eu-ets',
      tenantId: expected.tenantId,
      year: expected.year,
      shipName: expected.shipName,
      imo: expected.imo,
      organizationSlug,
      status:
        ytdEmissions.status === 'match' &&
        ytdEuaRequired.status === 'match' &&
        forecastEuaRequired.status === 'match'
          ? 'matched'
          : 'mismatch',
      details: { ytdEmissions, ytdEuaRequired, forecastEuaRequired },
    })
  }
  return rows
}

async function compareFuelEu(
  dataSource: DataSource,
  expectedMap: Map<string, MysqlFuelEuExpected>,
  voyagePresence: Set<string>,
  orgIdBySlug: Map<string, string>,
  pgShipByOrgAndImo: Map<string, { id: string; imo: string; name: string; organizationId: string }>,
): Promise<CompareRow[]> {
  const rows: CompareRow[] = []
  for (const expected of expectedMap.values()) {
    const organizationSlug = tenantIdToOrgSlug(expected.tenantId)
    const organizationId = organizationSlug ? orgIdBySlug.get(organizationSlug) ?? null : null
    if (!organizationId) {
      rows.push(buildMissingShipRow('fueleu', expected, organizationSlug))
      continue
    }
    const ship = pgShipByOrgAndImo.get(`${organizationId}:${expected.imo}`)
    if (!ship) {
      rows.push(buildMissingShipRow('fueleu', expected, organizationSlug))
      continue
    }
    const voyages = await fetchPgVoyages(dataSource, ship.id, organizationId, expected.year)
    if (voyages.length === 0) {
      rows.push(buildMissingVoyagesRow('fueleu', expected, organizationSlug, voyagePresence.has(`${expected.tenantId}:${expected.shipId}:${expected.year}`)))
      continue
    }
    const fuelEuTarget = await fetchPgFuelEuTarget(dataSource, expected.year)
    const voyagesWithFuelEntries = await enrichVoyagesWithFuelEuEntries(dataSource, voyages, organizationId, expected.year)
    const actual = calculateFuelEuReport(voyagesWithFuelEntries.map((voyage) => ({
      ...voyage,
      fuelEuTarget,
    })))
    const ghgActual = buildMetricDiff(expected.ghgActual, actual.metrics.actual, 0.01)
    const totalPenalty = buildMetricDiff(expected.totalPenalty, actual.metrics.penalty, 0.01)
    rows.push({
      framework: 'fueleu',
      tenantId: expected.tenantId,
      year: expected.year,
      shipName: expected.shipName,
      imo: expected.imo,
      organizationSlug,
      status: ghgActual.status === 'match' && totalPenalty.status === 'match' ? 'matched' : 'mismatch',
      details: { ghgActual, totalPenalty },
    })
  }
  return rows
}

async function fetchPgVoyages(dataSource: DataSource, shipId: string, organizationId: string, year: number) {
  return dataSource.query(
    'SELECT id, "departureDate", "departurePortCode", "arrivalPortCode", "arrivalPurpose", "throughIce", "distanceNm", emissions FROM "shipping_voyages" WHERE "organizationId" = $1 AND "shipId" = $2 AND EXTRACT(YEAR FROM "departureDate") = $3 ORDER BY "departureDate" ASC',
    [organizationId, shipId, year],
  ) as Promise<Array<{ id: string; departureDate: string | null; departurePortCode: string | null; arrivalPortCode: string | null; arrivalPurpose: string | null; throughIce: boolean; distanceNm: number; emissions: number }>>
}

async function fetchPgFuelEuTarget(dataSource: DataSource, year: number) {
  const yearRows = await dataSource.query(
    'SELECT "fuelEuTarget" FROM "shipping_year_parameters" WHERE year = $1 LIMIT 1',
    [year],
  ) as Array<{ fuelEuTarget: number | null }>
  return Number(yearRows[0]?.fuelEuTarget || 89)
}

async function enrichVoyagesWithFuelEuEntries(
  dataSource: DataSource,
  voyages: Array<{ id?: string; departureDate: string | null; departurePortCode: string | null; arrivalPortCode: string | null; arrivalPurpose: string | null; throughIce: boolean; distanceNm: number; emissions: number }>,
  organizationId: string,
  year: number,
) {
  const voyageIds = voyages.map((voyage: any) => voyage.id).filter(Boolean)
  if (voyageIds.length === 0) {
    return voyages
  }

  const fuelRows = await dataSource.query(
    `SELECT vf."voyageId", vf."fuelCode", vf.consumption,
            COALESCE(tf.lcv, sf.lcv, 0) AS lcv,
            COALESCE(tf."wellToTankFactor", sf."wellToTankFactor", 0) AS "wellToTankFactor",
            COALESCE(tf."tankToWakeFactor", sf."tankToWakeFactor", 0) AS "tankToWakeFactor"
       FROM "shipping_voyage_fuels" vf
       LEFT JOIN "shipping_tenant_fuel_types" tf
         ON tf.name = vf."fuelCode" AND tf."organizationId" = $1
       LEFT JOIN "shipping_system_fuel_types" sf
         ON sf.name = vf."fuelCode"
      WHERE vf."voyageId" = ANY($2)`,
    [organizationId, voyageIds],
  ) as Array<{ voyageId: string; fuelCode: string; consumption: number; lcv: number; wellToTankFactor: number; tankToWakeFactor: number }>

  const fuelRowsByVoyageId = new Map<string, Array<{ fuelCode: string; consumption: number; lcv: number; wellToTankFactor: number; tankToWakeFactor: number }>>()
  for (const row of fuelRows) {
    const items = fuelRowsByVoyageId.get(row.voyageId) ?? []
    items.push({
      fuelCode: row.fuelCode,
      consumption: Number(row.consumption || 0),
      lcv: Number(row.lcv || 0),
      wellToTankFactor: Number(row.wellToTankFactor || 0),
      tankToWakeFactor: Number(row.tankToWakeFactor || 0),
    })
    fuelRowsByVoyageId.set(row.voyageId, items)
  }

  return voyages.map((voyage: any) => ({
    ...voyage,
    fuelEntries: fuelRowsByVoyageId.get(voyage.id) ?? [],
  }))
}

async function fetchPgCiiContext(dataSource: DataSource, shipId: string, organizationId: string, year: number) {
  const shipRows = await dataSource.query(
    'SELECT type, dwt, gt, "ciiMeasureStandard", "constantA", "constantC", "constantCapacity" FROM "shipping_ships" WHERE id = $1 AND "organizationId" = $2 LIMIT 1',
    [shipId, organizationId],
  ) as Array<{ type: string | null; dwt: number | null; gt: number | null; ciiMeasureStandard: string | null; constantA: number | null; constantC: number | null; constantCapacity: number | null }>
  const ship = shipRows[0]
  if (!ship) {
    return null
  }

  const regulationRows = await dataSource.query(
    'SELECT "reductionRatio" FROM "shipping_regulation_parameters" WHERE year = $1 LIMIT 1',
    [year],
  ) as Array<{ reductionRatio: number | null }>
  const reductionRatio = Number(regulationRows[0]?.reductionRatio || 0)
  const capacity = ship.ciiMeasureStandard === 'GT'
    ? Number(ship.gt || 0)
    : Number(ship.dwt || ship.constantCapacity || 0)
  if (!capacity) {
    return null
  }

  const referenceCii = ship.constantA && ship.constantC
    ? round((Number(ship.constantA) / Math.pow(capacity, Number(ship.constantC))), 4)
    : 4.8
  const requiredCii = round(referenceCii * (1 - reductionRatio), 4)
  const ciiParameterRows = await dataSource.query(
    'SELECT d1, d2, d3, d4 FROM "shipping_cii_ship_type_parameters" WHERE "shipType" = $1 AND "applicableStandard" = $2 AND "rangeMin" <= $3 AND ("rangeMax" IS NULL OR "rangeMax" >= $3) ORDER BY "rangeMin" DESC LIMIT 1',
    [ship.type, ship.ciiMeasureStandard || 'DWT', capacity],
  ) as Array<{ d1: number | null; d2: number | null; d3: number | null; d4: number | null }>
  const ciiParameter = ciiParameterRows[0]

  return { capacity, referenceCii, requiredCii, d1: ciiParameter?.d1 ?? null, d2: ciiParameter?.d2 ?? null, d3: ciiParameter?.d3 ?? null, d4: ciiParameter?.d4 ?? null }
}

function buildMissingShipRow(framework: CompareRow['framework'], expected: MysqlShipRef & { year: number }, organizationSlug: string | null): CompareRow {
  return {
    framework,
    tenantId: expected.tenantId,
    year: expected.year,
    shipName: expected.shipName,
    imo: expected.imo,
    organizationSlug,
    status: 'missing_pg_ship',
    details: {},
  }
}

function buildMissingVoyagesRow(
  framework: CompareRow['framework'],
  expected: MysqlShipRef & { year: number },
  organizationSlug: string | null,
  mysqlHasSourceVoyages: boolean,
): CompareRow {
  return {
    framework,
    tenantId: expected.tenantId,
    year: expected.year,
    shipName: expected.shipName,
    imo: expected.imo,
    organizationSlug,
    status: mysqlHasSourceVoyages ? 'missing_pg_voyages' : 'missing_source_voyages',
    details: mysqlHasSourceVoyages ? {} : { note: 'mysql_dump_has_no_ship_voyage_rows_for_ship_year' },
  }
}

function tenantIdToOrgSlug(tenantId: string): string {
  return tenantId === '1' ? 'default' : `legacy-tenant-${tenantId}`
}

function renderMarkdownReport(rows: CompareRow[]): string {
  const summary = summarize(rows)
  const lines = [
    '# Shipping PG Recompute vs MySQL Result Compare',
    '',
    '| Framework | Total | Matched | Mismatch | Missing Ship | Missing PG Voyages | Missing Source Voyages |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary).map(([framework, item]) => `| ${framework} | ${item.total} | ${item.matched} | ${item.mismatch} | ${item.missingShip} | ${item.missingPgVoyages} | ${item.missingSourceVoyages} |`),
    '',
  ]

  for (const framework of ['cii', 'eu-ets', 'fueleu'] as const) {
    lines.push(`## ${framework}`)
    lines.push('')
    const frameworkRows = rows.filter((row) => row.framework === framework)
    for (const row of frameworkRows.slice(0, 50)) {
      lines.push(`- ${row.status.toUpperCase()} | tenant=${row.tenantId} | org=${row.organizationSlug ?? '-'} | ship=${row.shipName} | imo=${row.imo} | year=${row.year} | details=${JSON.stringify(row.details)}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

function summarize(rows: CompareRow[]) {
  return rows.reduce<Record<string, { total: number; matched: number; mismatch: number; missingShip: number; missingPgVoyages: number; missingSourceVoyages: number }>>((acc, row) => {
    acc[row.framework] ??= { total: 0, matched: 0, mismatch: 0, missingShip: 0, missingPgVoyages: 0, missingSourceVoyages: 0 }
    acc[row.framework].total += 1
    if (row.status === 'matched') acc[row.framework].matched += 1
    if (row.status === 'mismatch') acc[row.framework].mismatch += 1
    if (row.status === 'missing_pg_ship') acc[row.framework].missingShip += 1
    if (row.status === 'missing_pg_voyages') acc[row.framework].missingPgVoyages += 1
    if (row.status === 'missing_source_voyages') acc[row.framework].missingSourceVoyages += 1
    return acc
  }, {})
}

function parseTableRows(sql: string, tableName: string): MysqlRow[] {
  const columns = parseCreateColumns(sql, tableName)
  if (columns.length === 0) return []
  const insertRegex = new RegExp('INSERT INTO \\`' + escapeRegExp(tableName) + '\\` VALUES \\((.*)\\);', 'g')
  const rows: MysqlRow[] = []
  let match: RegExpExecArray | null
  while ((match = insertRegex.exec(sql)) !== null) {
    const values = splitSqlValues(match[1])
    rows.push(Object.fromEntries(columns.map((column, index) => [column, parseSqlValue(values[index] ?? 'NULL')])))
  }
  return rows
}

function parseCreateColumns(sql: string, tableName: string): string[] {
  const createRegex = new RegExp('CREATE TABLE \\`' + escapeRegExp(tableName) + '\\`\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE', 'm')
  const createMatch = sql.match(createRegex)
  if (!createMatch) return []
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
  if (current.length > 0) values.push(current.trim())
  return values
}

function parseSqlValue(rawValue: string): string | number | null {
  const normalized = rawValue.trim()
  if (normalized === 'NULL') return null
  if (normalized.startsWith("'") && normalized.endsWith("'")) return normalized.slice(1, -1).replace(/\\'/g, "'")
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? normalized : numeric
}

function normalizeString(value: string | number | null): string | null {
  if (value === null || value === '') return null
  return String(value)
}

function toNumber(value: string | number | null): number {
  if (typeof value === 'number') return value
  if (value === null || value === '') return 0
  return Number(value)
}

function nullableNumber(value: string | number | null): number | null {
  if (value === null || value === '') return null
  return toNumber(value)
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function main(): Promise<void> {
  const sqlPath = process.argv[2] ?? resolve(process.cwd(), '../tests/route_carbon_analyzer_backup.sql')
  const outputPath = process.argv[3] ?? resolve(process.cwd(), '../docs/reports/shipping-recompute-compare-report.md')
  const sql = readFileSync(sqlPath, 'utf8')
  const rows = await compareAgainstPg(sql)
  const markdown = renderMarkdownReport(rows)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, markdown, 'utf8')
  process.stdout.write(`Report written to ${outputPath}\n`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Recompute compare error:', error)
    process.exit(1)
  })
}
