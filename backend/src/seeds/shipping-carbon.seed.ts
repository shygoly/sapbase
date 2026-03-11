import { DataSource } from 'typeorm'
import { Port } from '../shipping-carbon/infrastructure/persistence/entities/port.entity'
import { SystemFuelType } from '../shipping-carbon/infrastructure/persistence/entities/system-fuel-type.entity'
import { YearParameter } from '../shipping-carbon/infrastructure/persistence/entities/year-parameter.entity'
import { CiiShipTypeParameter } from '../shipping-carbon/infrastructure/persistence/entities/cii-ship-type-parameter.entity'
import { RegulationParameter } from '../shipping-carbon/infrastructure/persistence/entities/regulation-parameter.entity'
import { ShipTypeParameter } from '../shipping-carbon/infrastructure/persistence/entities/ship-type-parameter.entity'
import { CiiCompliantShipType } from '../shipping-carbon/infrastructure/persistence/entities/cii-compliant-ship-type.entity'
import { GwpValue } from '../shipping-carbon/infrastructure/persistence/entities/gwp-value.entity'
import { CsfValue } from '../shipping-carbon/infrastructure/persistence/entities/csf-value.entity'
import { WindAssistFactor } from '../shipping-carbon/infrastructure/persistence/entities/wind-assist-factor.entity'
import { CurrencyExchangeRate } from '../shipping-carbon/infrastructure/persistence/entities/currency-exchange-rate.entity'
import { FuelPrice } from '../shipping-carbon/infrastructure/persistence/entities/fuel-price.entity'
import { FuelEuEtsCfCo2 } from '../shipping-carbon/infrastructure/persistence/entities/fuel-eu-ets-cf-co2.entity'

export async function seedShippingCarbonBasics(dataSource: DataSource) {
  const portRepo = dataSource.getRepository(Port)
  const fuelRepo = dataSource.getRepository(SystemFuelType)
  const yearRepo = dataSource.getRepository(YearParameter)
  const ciiRepo = dataSource.getRepository(CiiShipTypeParameter)
  const regulationRepo = dataSource.getRepository(RegulationParameter)
  const shipTypeRepo = dataSource.getRepository(ShipTypeParameter)
  const compliantShipTypeRepo = dataSource.getRepository(CiiCompliantShipType)
  const gwpRepo = dataSource.getRepository(GwpValue)
  const csfRepo = dataSource.getRepository(CsfValue)
  const windRepo = dataSource.getRepository(WindAssistFactor)
  const exchangeRepo = dataSource.getRepository(CurrencyExchangeRate)
  const fuelPriceRepo = dataSource.getRepository(FuelPrice)
  const etsCfRepo = dataSource.getRepository(FuelEuEtsCfCo2)

  const ports = [
    { code: 'CNSHA', name: 'Shanghai', country: 'CN', isEu: false },
    { code: 'NLRTM', name: 'Rotterdam', country: 'NL', isEu: true },
    { code: 'DEHAM', name: 'Hamburg', country: 'DE', isEu: true },
    { code: 'NOOSL', name: 'Oslo', country: 'NO', isEu: false },
    { code: 'ISREY', name: 'Reykjavík', country: 'IS', isEu: false },
  ]

  const fuels = [
    { name: 'VLSFO', code: 'VLSFO', lcv: 40.5, wellToTankFactor: 13.5, tankToWakeFactor: 74.0, co2Factor: 3.114, slipFactor: 0, defaultPrice: 580 },
    { name: 'MGO', code: 'MGO', lcv: 42.7, wellToTankFactor: 14.2, tankToWakeFactor: 75.1, co2Factor: 3.206, slipFactor: 0, defaultPrice: 760 },
    { name: 'LNG', code: 'LNG', lcv: 49.1, wellToTankFactor: 18.5, tankToWakeFactor: 56.1, co2Factor: 2.75, slipFactor: 3.1, defaultPrice: 690 },
  ]

  const yearParameters = [
    { year: 2024, fuelEuTarget: 89, etsCoverageRatio: 0.4, euaPrice: 0.085 },
    { year: 2025, fuelEuTarget: 89, etsCoverageRatio: 0.7, euaPrice: 0.09 },
    { year: 2026, fuelEuTarget: 87.5, etsCoverageRatio: 1.0, euaPrice: 0.095 },
  ]

  const ciiParameters = [
    { shipType: 'Container', referenceCii: 4.8, requiredCii: 4.5, correctionFactor: 1 },
    { shipType: 'Bulk Carrier', referenceCii: 5.1, requiredCii: 4.7, correctionFactor: 1 },
    { shipType: 'Tanker', referenceCii: 5.0, requiredCii: 4.6, correctionFactor: 1 },
  ]

  const regulationParameters = [
    { year: 2024, reductionRatio: 7, ghgTarget: 89, euaPriceEur: 85, excessPenaltyPerTon: 2400 },
    { year: 2025, reductionRatio: 9, ghgTarget: 89, euaPriceEur: 90, excessPenaltyPerTon: 2400 },
    { year: 2026, reductionRatio: 11, ghgTarget: 87.5, euaPriceEur: 95, excessPenaltyPerTon: 2450 },
  ]

  const shipTypeParameters = [
    { shipType: 'Container', capacityBasis: 'DWT', a: 1984, c: 0.489, d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.18 },
    { shipType: 'Bulk Carrier', capacityBasis: 'DWT', a: 4745, c: 0.622, d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.18 },
    { shipType: 'Tanker', capacityBasis: 'DWT', a: 5247, c: 0.61, d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.18 },
  ]

  const compliantShipTypes = [
    { shipType: 'Container' },
    { shipType: 'Bulk Carrier' },
    { shipType: 'Tanker' },
  ]

  const gwpValues = [
    { gas: 'CO2', gwp: 1 },
    { gas: 'CH4', gwp: 28 },
    { gas: 'N2O', gwp: 265 },
  ]

  const csfValues = [
    { gas: 'CO2', csf: 0 },
    { gas: 'CH4', csf: 1 },
    { gas: 'N2O', csf: 0 },
  ]

  const windAssistFactors = [
    { deviceType: 'Rotor sail', factor: 0.99 },
    { deviceType: 'Wing sail', factor: 0.97 },
  ]

  const exchangeRates = [
    { fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.08, effectiveDate: '2025-01-01' },
    { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.926, effectiveDate: '2025-01-01' },
  ]

  const fuelPrices = [
    { organizationId: null, fuelCode: 'VLSFO', year: 2025, priceUsdPerTon: 580 },
    { organizationId: null, fuelCode: 'MGO', year: 2025, priceUsdPerTon: 760 },
    { organizationId: null, fuelCode: 'LNG', year: 2025, priceUsdPerTon: 690 },
  ]

  const etsCfValues = [
    { fuelCode: 'VLSFO', year: 2025, cfCo2Ets: 3.114 },
    { fuelCode: 'MGO', year: 2025, cfCo2Ets: 3.206 },
    { fuelCode: 'LNG', year: 2025, cfCo2Ets: 2.75 },
  ]

  for (const port of ports) {
    await portRepo.upsert(port, ['code'])
  }
  for (const fuel of fuels) {
    await fuelRepo.upsert(fuel, ['name'])
  }
  for (const year of yearParameters) {
    await yearRepo.upsert(year, ['year'])
  }
  for (const cii of ciiParameters) {
    await ciiRepo.upsert(cii, ['shipType'])
  }
  for (const regulation of regulationParameters) {
    await regulationRepo.upsert(regulation, ['year'])
  }
  for (const shipType of shipTypeParameters) {
    await shipTypeRepo.upsert(shipType, ['shipType'])
  }
  for (const compliant of compliantShipTypes) {
    await compliantShipTypeRepo.upsert(compliant, ['shipType'])
  }
  for (const gwp of gwpValues) {
    await gwpRepo.upsert(gwp, ['gas'])
  }
  for (const csf of csfValues) {
    await csfRepo.upsert(csf, ['gas'])
  }
  for (const wind of windAssistFactors) {
    await windRepo.upsert(wind, ['deviceType'])
  }
  for (const exchange of exchangeRates) {
    await exchangeRepo.upsert(exchange, ['fromCurrency', 'toCurrency', 'effectiveDate'])
  }
  for (const fuelPrice of fuelPrices) {
    await fuelPriceRepo.upsert(fuelPrice, ['organizationId', 'fuelCode', 'year'])
  }
  for (const etsCf of etsCfValues) {
    await etsCfRepo.upsert(etsCf, ['fuelCode', 'year'])
  }
}

if (require.main === module) {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'mac',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'carbon',
    entities: [Port, SystemFuelType, YearParameter, CiiShipTypeParameter, RegulationParameter, ShipTypeParameter, CiiCompliantShipType, GwpValue, CsfValue, WindAssistFactor, CurrencyExchangeRate, FuelPrice, FuelEuEtsCfCo2],
    synchronize: false,
    logging: false,
  })

  dataSource.initialize()
    .then(() => seedShippingCarbonBasics(dataSource))
    .finally(() => dataSource.destroy())
}
