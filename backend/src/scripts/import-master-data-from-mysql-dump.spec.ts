import {
  buildMasterDatasets,
  importMasterDatasets,
} from './import-master-data-from-mysql-dump'

describe('import-master-data-from-mysql-dump', () => {
  it('builds ship, charter, voyage and fuel datasets from mysql dump', () => {
    const sql = `
CREATE TABLE \`ship_info\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL DEFAULT 1,
  \`ship_name\` varchar(100) NOT NULL,
  \`ship_type_id\` bigint(20) NOT NULL,
  \`imo_number\` varchar(20) NOT NULL,
  \`gross_tonnage\` decimal(15, 2) NOT NULL,
  \`dead_weight\` decimal(15, 2) NOT NULL,
  \`constant_a\` decimal(65, 6) NULL DEFAULT NULL,
  \`constant_capacity\` decimal(15, 6) NULL DEFAULT NULL,
  \`constant_c\` decimal(15, 6) NULL DEFAULT NULL,
  \`status\` int(1) NOT NULL DEFAULT 1,
  \`cii_measure_standard\` varchar(100) NULL DEFAULT NULL,
  \`wind_assisted_propulsion\` varchar(100) NULL DEFAULT NULL,
  \`main_engine_power\` decimal(15, 6) NULL DEFAULT NULL,
  \`auxiliary_engine_power\` decimal(15, 6) NULL DEFAULT NULL,
  \`is_wind_power_applicable\` int(1) NULL DEFAULT NULL,
  \`wind_equipment_installation_time\` datetime NULL DEFAULT NULL,
  \`cii_applicable\` tinyint(1) NULL DEFAULT 0,
  \`flag_state\` varchar(100) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_info\` VALUES (10, 3, 'Aurora', 4, 'IMO1234567', 9988.00, 12345.00, 5247.000000, 3604.000000, 0.610000, 1, 'DWT', 'Rotor sail', 12000.500000, 800.200000, 1, '2025-08-01 10:00:00', 1, 'CN');
CREATE TABLE \`ship_charter_info\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL DEFAULT 1,
  \`ship_id\` bigint(20) NOT NULL,
  \`contract_no\` varchar(50) NULL DEFAULT NULL,
  \`charterer_name\` varchar(100) NULL DEFAULT NULL,
  \`lease_start_date\` datetime NOT NULL,
  \`lease_end_date\` datetime NOT NULL,
  \`lease_type\` varchar(20) NULL DEFAULT NULL,
  \`main_fuel_type\` varchar(50) NULL DEFAULT NULL,
  \`auxiliary_fuel_type\` varchar(50) NULL DEFAULT NULL,
  \`main_fuel_consumption\` decimal(10, 2) NULL DEFAULT NULL,
  \`auxiliary_fuel_consumption\` decimal(10, 2) NULL DEFAULT NULL,
  \`shore_electricity\` decimal(10, 2) NULL DEFAULT NULL,
  \`contract_path\` varchar(500) NULL DEFAULT NULL,
  \`bdn_path\` varchar(500) NULL DEFAULT NULL,
  \`is_auto_generated\` tinyint(1) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_charter_info\` VALUES (20, 3, 10, 'CN-001', 'Acme Charter', '2025-01-01 00:00:00', '2025-12-31 00:00:00', 'TIME', 'VLSFO', 'MGO', 100.50, 20.25, 300.00, '/tmp/contract.pdf', '/tmp/charter-bdn.pdf', 1);
CREATE TABLE \`ship_voyage\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL DEFAULT 1,
  \`ship_id\` bigint(20) NOT NULL,
  \`start_port\` varchar(100) NOT NULL,
  \`start_port_code\` varchar(50) NULL DEFAULT NULL,
  \`end_port\` varchar(100) NOT NULL,
  \`end_port_code\` varchar(50) NULL DEFAULT NULL,
  \`arrival_time\` datetime NOT NULL,
  \`departure_time\` datetime NOT NULL,
  \`arrival_purpose\` varchar(200) NULL DEFAULT NULL,
  \`route_distance\` decimal(10, 2) NULL DEFAULT NULL,
  \`fuel_type\` varchar(50) NULL DEFAULT NULL,
  \`fuel_consumption\` decimal(10, 2) NULL DEFAULT NULL,
  \`total_eu_ets\` decimal(15, 2) NULL DEFAULT NULL,
  \`auxiliary_fuel_type\` varchar(50) NULL DEFAULT NULL,
  \`auxiliary_fuel_consumption\` decimal(10, 2) NULL DEFAULT NULL,
  \`shore_power_consumption\` double NULL DEFAULT NULL,
  \`bdn_path\` varchar(500) NULL DEFAULT NULL,
  \`charter_info_id\` bigint(20) NULL DEFAULT NULL,
  \`charterer_name\` varchar(100) NULL DEFAULT NULL,
  \`through_ice\` varchar(50) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_voyage\` VALUES (30, 5, 10, 'Shanghai', 'CNSHA', 'Rotterdam', 'NLRTM', '2025-02-10 12:00:00', '2025-01-25 08:00:00', 'Cargo discharge', 1200.50, 3, 55.50, 888.88, 4, 11.25, 100.00, '/tmp/bdn.pdf', 20, 'Acme Charter', 'YES');
INSERT INTO \`ship_voyage\` VALUES (31, 5, 10, 'Rotterdam', 'NLRTM', 'Zeebrugge', 'BEZEE', '2025-02-15 12:00:00', '2025-02-14 08:00:00', 'Cargo loading', 160.00, 3, 10.00, 0.00, NULL, NULL, NULL, NULL, 20, 'Acme Charter', '1');
CREATE TABLE \`fuel_type\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL DEFAULT 1,
  \`fuel\` varchar(100) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`fuel_type\` VALUES (3, 1, 'VLSFO');
INSERT INTO \`fuel_type\` VALUES (4, 1, 'MGO');
CREATE TABLE \`ship_type\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`ship_type_code\` varchar(50) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_type\` VALUES (4, 'TANKER');
`

    const datasets = buildMasterDatasets(sql, { organizationIdByTenantId: { '3': 'org-3', '5': 'org-5' } })

    expect(datasets.ships).toHaveLength(1)
    expect(datasets.ships[0]).toMatchObject({
      organizationId: 'org-3',
      sourceId: 10,
      name: 'Aurora',
      imo: 'IMO1234567',
      type: 'TANKER',
      shipTypeId: 4,
      gt: 9988,
      dwt: 12345,
      ciiApplicable: true,
      windAssistedPropulsion: 'Rotor sail',
      flagState: 'CN',
    })

    expect(datasets.charters).toHaveLength(1)
    expect(datasets.charters[0]).toMatchObject({
      organizationId: 'org-3',
      sourceId: 20,
      shipSourceId: 10,
      contractNo: 'CN-001',
      charterer: 'Acme Charter',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      allocation: 'TIME',
      mainFuelType: 'VLSFO',
      auxiliaryFuelType: 'MGO',
      mainFuelConsumption: 100.5,
      auxiliaryFuelConsumption: 20.25,
      shoreElectricityKwh: 300,
      contractPath: '/tmp/contract.pdf',
      bdnPath: '/tmp/charter-bdn.pdf',
      isAutoGenerated: true,
    })

    expect(datasets.voyages).toHaveLength(2)
    expect(datasets.voyages[0]).toMatchObject({
      organizationId: 'org-5',
      sourceId: 30,
      shipSourceId: 10,
      charterSourceId: 20,
      departurePort: 'Shanghai',
      departurePortCode: 'CNSHA',
      arrivalPort: 'Rotterdam',
      arrivalPortCode: 'NLRTM',
      distanceNm: 1200.5,
      totalEuEts: 888.88,
      shorePowerConsumptionMj: 360,
      throughIce: true,
    })
    expect(datasets.voyages[1]).toMatchObject({
      sourceId: 31,
      departurePortCode: 'NLRTM',
      arrivalPortCode: 'BEZEE',
      throughIce: true,
    })

    expect(datasets.voyageFuels).toEqual([
      { voyageSourceId: 30, fuelCode: 'VLSFO', consumption: 55.5, isMain: true },
      { voyageSourceId: 30, fuelCode: 'MGO', consumption: 11.25, isMain: false },
      { voyageSourceId: 31, fuelCode: 'VLSFO', consumption: 10, isMain: true },
    ])
  })

  it('writes master datasets with generated uuid mapping', async () => {
    const query = jest.fn()
    const datasets = {
      ships: [{ sourceId: 10, organizationId: 'org-3', name: 'Aurora', imo: 'IMO1234567', type: 'TANKER', status: 'ACTIVE' }],
      charters: [{ sourceId: 20, shipSourceId: 10, organizationId: 'org-3', contractNo: 'CN-001', charterer: 'Acme Charter', startDate: '2025-01-01', endDate: '2025-12-31', status: 'ACTIVE', allocation: 'TIME', contractPath: '/tmp/contract.pdf', mainFuelType: 'VLSFO', auxiliaryFuelType: 'MGO', mainFuelConsumption: 100.5, auxiliaryFuelConsumption: 20.25, shoreElectricityKwh: 300, bdnPath: '/tmp/charter-bdn.pdf', isAutoGenerated: true }],
      voyages: [{ sourceId: 30, shipSourceId: 10, charterSourceId: 20, organizationId: 'org-5', voyageNo: 'VOY-30', departurePort: 'Shanghai', arrivalPort: 'Rotterdam', distanceNm: 1200.5, emissions: 0, throughIce: true, status: 'COMPLETED' }],
      voyageFuels: [{ voyageSourceId: 30, fuelCode: 'VLSFO', consumption: 55.5, isMain: true }],
    }

    await importMasterDatasets({ query } as never, datasets as never)

    expect(query.mock.calls.some((call) => String(call[0]).includes('DELETE FROM "shipping_voyage_fuels"'))).toBe(true)
    expect(query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO "shipping_ships"'))).toBe(true)
    const charterInsertCall = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO "shipping_charters"'))
    expect(charterInsertCall).toBeDefined()
    expect(String(charterInsertCall?.[0])).toContain('"contractNo"')
    expect(String(charterInsertCall?.[0])).toContain('"mainFuelType"')
    expect(String(charterInsertCall?.[0])).toContain('"shoreElectricityKwh"')
    expect(charterInsertCall?.[1]).toContain('org-3')
    const voyageInsertCall = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO "shipping_voyages"'))
    expect(voyageInsertCall).toBeDefined()
    expect(voyageInsertCall?.[1]).toContain('org-5')
    expect(query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO "shipping_voyage_fuels"'))).toBe(true)
  })
})
