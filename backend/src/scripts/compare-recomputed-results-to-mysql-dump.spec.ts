import {
  aggregateMysqlExpectedResults,
  buildMetricDiff,
} from './compare-recomputed-results-to-mysql-dump'

describe('compare-recomputed-results-to-mysql-dump', () => {
  it('aggregates mysql result tables by tenant ship and year', () => {
    const sql = `
CREATE TABLE \`ship_info\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL,
  \`ship_name\` varchar(100) NOT NULL,
  \`imo_number\` varchar(20) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_info\` VALUES (4, 1, 'Aurora', 'IMO123');
CREATE TABLE \`ship_voyage\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL,
  \`ship_id\` bigint(20) NOT NULL,
  \`departure_time\` datetime NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_voyage\` VALUES (9, 1, 4, '2025-01-25 08:00:00');
CREATE TABLE \`cii_evaluation_detail\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL,
  \`ship_id\` bigint(20) NOT NULL,
  \`year\` int(4) NOT NULL,
  \`emission_value\` decimal(15,4) NULL,
  \`cii_required\` decimal(15,4) NULL,
  \`rating\` varchar(10) NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`cii_evaluation_detail\` VALUES (1, 1, 4, 2025, 133.7580, 6.6599, 'E');
CREATE TABLE \`eu_ets_detail\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL,
  \`ship_id\` bigint(20) NOT NULL,
  \`voyage_id\` bigint(20) NOT NULL,
  \`emission_value\` decimal(20,4) NULL,
  \`penalty\` decimal(20,4) NULL,
  \`forecast_value\` decimal(20,4) NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`eu_ets_detail\` VALUES (1, 1, 4, 9, 100.5, 70.35, 120.6);
INSERT INTO \`eu_ets_detail\` VALUES (2, 1, 4, 9, 20.0, 14.0, 25.0);
CREATE TABLE \`fuel_eu_calculation_result\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`tenant_id\` bigint(20) NOT NULL,
  \`ship_id\` bigint(20) NOT NULL,
  \`assessment_year\` int(4) NOT NULL,
  \`ghg_actual_value\` decimal(20,10) NULL,
  \`total_penalty_amount\` decimal(20,6) NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`fuel_eu_calculation_result\` VALUES (1, 1, 4, 2025, 88.1234, 456.780000);
`

    const result = aggregateMysqlExpectedResults(sql)
    const cii = result.cii.get('1:4:2025')
    const ets = result.ets.get('1:4:2025')
    const fueleu = result.fuelEu.get('1:4:2025')

    expect(cii).toMatchObject({ shipName: 'Aurora', imo: 'IMO123', attainedCii: 133.758, requiredCii: 6.6599, rating: 'E' })
    expect(ets).toMatchObject({ ytdEmissions: 0.0001, ytdEuaRequired: 0.0001, forecastEuaRequired: 0.0001 })
    expect(fueleu).toMatchObject({ ghgActual: 88.1234, totalPenalty: 456.78 })
    expect(result.voyagePresence.has('1:4:2025')).toBe(true)
  })

  it('builds numeric diffs with tolerance status', () => {
    expect(buildMetricDiff(10, 10.004, 0.01)).toMatchObject({ status: 'match' })
    expect(buildMetricDiff(10, 12, 0.01)).toMatchObject({ status: 'diff', delta: 2 })
    expect(buildMetricDiff(null, 12, 0.01)).toMatchObject({ status: 'missing_expected' })
  })
})
