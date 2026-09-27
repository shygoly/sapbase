import {
  buildFoundationDatasets,
  importFoundationDatasets,
} from './import-foundation-from-mysql-dump'

describe('import-foundation-from-mysql-dump', () => {
  it('builds foundation datasets from mysql dump', () => {
    const sql = `
CREATE TABLE \`annual_configuration\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`config_year\` int(4) NOT NULL,
  \`ghg_intensity_target\` decimal(20, 10) NULL DEFAULT NULL,
  \`cii_reduction_rate\` decimal(10, 4) NULL DEFAULT NULL,
  \`fuel_eu_penalty\` decimal(10, 2) NULL DEFAULT NULL,
  \`eua_price\` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`annual_configuration\` VALUES (1, 2025, 89.3400000000, 0.0900, 2400.00, 85.00);
CREATE TABLE \`fuel_type\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL DEFAULT 1,
  \`fuel\` varchar(100) NOT NULL,
  \`lcv\` decimal(10, 6) NULL DEFAULT NULL,
  \`co2eq_wtt\` decimal(10, 6) NULL DEFAULT NULL,
  \`co2eq_ttw\` decimal(10, 6) NULL DEFAULT NULL,
  \`co2eq_wtw\` decimal(10, 6) NULL DEFAULT NULL,
  \`cf_co2\` decimal(10, 6) NULL DEFAULT NULL,
  \`cf_ch4\` decimal(10, 6) NULL DEFAULT NULL,
  \`cf_n2o\` decimal(10, 6) NULL DEFAULT NULL,
  \`cslip\` decimal(10, 6) NULL DEFAULT NULL,
  \`gwp_co2\` decimal(10, 4) NULL DEFAULT 1.0000,
  \`gwp_ch4\` decimal(10, 4) NULL DEFAULT 28.0000,
  \`gwp_n2o\` decimal(10, 4) NULL DEFAULT 265.0000,
  \`csf_co2\` decimal(10, 4) NULL DEFAULT 0.0000,
  \`csf_ch4\` decimal(10, 4) NULL DEFAULT 1.0000,
  \`csf_n2o\` decimal(10, 4) NULL DEFAULT 0.0000,
  \`year\` int(11) NULL DEFAULT NULL,
  \`price\` decimal(10, 2) NULL DEFAULT NULL,
  \`cf_co2eq\` decimal(10, 4) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`fuel_type\` VALUES (1, 1, 'VLSFO', 0.040200, 14.400000, 76.000000, 90.400000, 3.114000, 0.000050, 0.000180, 0.000000, 1.0000, 28.0000, 265.0000, 0.0000, 1.0000, 0.0000, 2025, 621.00, 3.1140);
INSERT INTO \`fuel_type\` VALUES (2, 3, 'Tenant Fuel', 0.041000, 15.000000, 77.000000, 92.000000, 3.200000, 0.000050, 0.000180, 0.000000, 1.0000, 28.0000, 265.0000, 0.0000, 1.0000, 0.0000, 2026, 888.00, 3.2000);
CREATE TABLE \`ship_type\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`ship_type_code\` varchar(50) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_type\` VALUES (4, 'TANKER');
CREATE TABLE \`cii_config\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`ship_type_id\` bigint(20) NOT NULL,
  \`applicable_standard\` varchar(64) NOT NULL,
  \`range_min\` decimal(15, 2) NOT NULL,
  \`range_max\` decimal(15, 2) NULL DEFAULT NULL,
  \`constant_a\` decimal(65, 6) NOT NULL,
  \`constant_c\` decimal(15, 6) NOT NULL,
  \`d1\` decimal(10, 4) NOT NULL,
  \`d2\` decimal(10, 4) NOT NULL,
  \`d3\` decimal(10, 4) NOT NULL,
  \`d4\` decimal(10, 4) NOT NULL,
  \`constant_capacity\` decimal(15, 6) NOT NULL,
  \`use_max\` tinyint(1) NULL DEFAULT 0,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`cii_config\` VALUES (2, 4, 'DWT', 0.00, NULL, 5247.000000, 0.610000, 0.8200, 0.9300, 1.0800, 1.2800, 3604.000000, 0);
CREATE TABLE \`eu_port\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`port_code\` varchar(10) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`eu_port\` VALUES (1, 'NLRTM');
`

    const datasets = buildFoundationDatasets(sql, { organizationIdByTenantId: { '3': 'org-3' } })

    expect(datasets.yearParameters).toEqual([
      { year: 2025, fuelEuTarget: 89.34, etsCoverageRatio: 0.7, euaPrice: 85 },
    ])
    expect(datasets.regulationParameters).toEqual([
      { year: 2025, reductionRatio: 0.09, ghgTarget: 89.34, euaPriceEur: 85, excessPenaltyPerTon: 2400 },
    ])
    expect(datasets.systemFuelTypes).toEqual([
      {
        name: 'VLSFO',
        code: 'VLSFO',
        lcv: 0.0402,
        wellToTankFactor: 14.4,
        tankToWakeFactor: 78.68407960199004,
        co2eqWtw: 90.4,
        co2Factor: 3.114,
        slipFactor: 0,
        gwpCo2: 1,
        gwpCh4: 28,
        gwpN2o: 265,
        defaultPrice: 621,
      },
    ])
    expect(datasets.tenantFuelTypes).toEqual([
      {
        organizationId: 'org-3',
        name: 'Tenant Fuel',
        code: 'Tenant Fuel',
        lcv: 0.041,
        wellToTankFactor: 15,
        tankToWakeFactor: 79.24634146341463,
        co2eqWtw: 92,
        co2Factor: 3.2,
        slipFactor: 0,
        gwpCo2: 1,
        gwpCh4: 28,
        gwpN2o: 265,
        price: 888,
      },
    ])
    expect(datasets.fuelPrices).toEqual([
      { organizationId: null, fuelCode: 'VLSFO', year: 2025, priceUsdPerTon: 621 },
      { organizationId: 'org-3', fuelCode: 'Tenant Fuel', year: 2026, priceUsdPerTon: 888 },
    ])
    expect(datasets.fuelEuEtsCfCo2).toEqual([
      { fuelCode: 'VLSFO', year: 2025, cfCo2Ets: 3.114 },
      { fuelCode: 'Tenant Fuel', year: 2026, cfCo2Ets: 3.2 },
    ])
    expect(datasets.ciiShipTypeParameters).toEqual([
      {
        shipType: 'TANKER',
        applicableStandard: 'DWT',
        rangeMin: 0,
        rangeMax: null,
        referenceCii: 5247,
        requiredCii: 0.61,
        d1: 0.82,
        d2: 0.93,
        d3: 1.08,
        d4: 1.28,
        correctionFactor: 1,
        constantCapacity: 3604,
        useMax: false,
      },
    ])
    expect(datasets.ports).toEqual([
      { code: 'NLRTM', name: 'NLRTM', country: 'NL', isEu: true },
    ])
    expect(datasets.gwpValues).toEqual([
      { gas: 'CO2', gwp: 1 },
      { gas: 'CH4', gwp: 28 },
      { gas: 'N2O', gwp: 265 },
    ])
    expect(datasets.csfValues).toEqual([
      { gas: 'CO2', csf: 0 },
      { gas: 'CH4', csf: 1 },
      { gas: 'N2O', csf: 0 },
    ])
  })

  it('writes datasets with idempotent delete+insert queries', async () => {
    const query = jest.fn()
    const dataSource = { query }

    await importFoundationDatasets(
      dataSource as never,
      {
        ports: [{ code: 'NLRTM', name: 'NLRTM', country: 'NL', isEu: true }],
        systemFuelTypes: [{ name: 'VLSFO', code: 'VLSFO', lcv: 0.0402, wellToTankFactor: 14.4, tankToWakeFactor: 76, co2eqWtw: 90.4, co2Factor: 3.114, slipFactor: 0, gwpCo2: 1, gwpCh4: 28, gwpN2o: 265, defaultPrice: 621 }],
        tenantFuelTypes: [{ organizationId: 'org-3', name: 'Tenant Fuel', code: 'Tenant Fuel', lcv: 0.041, wellToTankFactor: 15, tankToWakeFactor: 77, co2eqWtw: 92, co2Factor: 3.2, slipFactor: 0, gwpCo2: 1, gwpCh4: 28, gwpN2o: 265, price: 888 }],
        yearParameters: [{ year: 2025, fuelEuTarget: 89.34, etsCoverageRatio: 0.7, euaPrice: 85 }],
        regulationParameters: [{ year: 2025, reductionRatio: 0.09, ghgTarget: 89.34, euaPriceEur: 85, excessPenaltyPerTon: 2400 }],
        ciiShipTypeParameters: [{ shipType: 'TANKER', applicableStandard: 'DWT', rangeMin: 0, rangeMax: null, referenceCii: 5247, requiredCii: 0.61, d1: 0.82, d2: 0.93, d3: 1.08, d4: 1.28, correctionFactor: 1, constantCapacity: 3604, useMax: false }],
        gwpValues: [{ gas: 'CO2', gwp: 1 }],
        csfValues: [{ gas: 'CO2', csf: 0 }],
        fuelPrices: [{ organizationId: null, fuelCode: 'VLSFO', year: 2025, priceUsdPerTon: 621 }],
        fuelEuEtsCfCo2: [{ fuelCode: 'VLSFO', year: 2025, cfCo2Ets: 3.114 }],
      },
    )

    expect(query).toHaveBeenCalled()
    expect(query.mock.calls.some((call) => String(call[0]).includes('DELETE FROM "shipping_ports"'))).toBe(true)
    expect(query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO "shipping_tenant_fuel_types"'))).toBe(true)
    expect(query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO "shipping_year_parameters"'))).toBe(true)
    expect(query.mock.calls.some((call) => String(call[0]).includes('shipping_cii_ship_type_parameters'))).toBe(true)
  })
})
