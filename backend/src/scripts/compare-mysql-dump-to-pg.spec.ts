import {
  compareSchemaMappings,
  parseMysqlDumpMetadata,
  renderMarkdownReport,
  type PgColumnRow,
} from './compare-mysql-dump-to-pg'

describe('compare-mysql-dump-to-pg', () => {
  it('parses mysql dump tables and insert counts', () => {
    const sql = `
CREATE TABLE \`ship_info\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`ship_name\` varchar(100) NOT NULL,
  \`gross_tonnage\` decimal(15, 2) NOT NULL,
  \`dead_weight\` decimal(15, 2) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_info\` VALUES (1, 'A', 100, 200);
INSERT INTO \`ship_info\` VALUES (2, 'B', 150, 220);
CREATE TABLE \`eu_port\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`port_code\` varchar(10) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`eu_port\` VALUES (1, 'CNSHA');
`

    const metadata = parseMysqlDumpMetadata(sql, ['ship_info', 'eu_port'])

    expect(metadata.ship_info?.insertCount).toBe(2)
    expect(metadata.ship_info?.columns).toEqual(['id', 'ship_name', 'gross_tonnage', 'dead_weight'])
    expect(metadata.eu_port?.insertCount).toBe(1)
    expect(metadata.eu_port?.columns).toEqual(['id', 'port_code'])
  })

  it('compares mapped mysql and pg schemas and reports missing fields', () => {
    const mysqlSql = `
CREATE TABLE \`ship_info\`  (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`ship_name\` varchar(100) NOT NULL,
  \`imo_number\` varchar(20) NOT NULL,
  \`gross_tonnage\` decimal(15, 2) NOT NULL,
  \`dead_weight\` decimal(15, 2) NOT NULL,
  \`flag_state\` varchar(100) NULL,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB;
INSERT INTO \`ship_info\` VALUES (1, 'A', 'IMO1', 100, 200, 'CN');
`
    const mysqlMetadata = parseMysqlDumpMetadata(mysqlSql, ['ship_info'])
    const pgColumns: PgColumnRow[] = [
      { tableName: 'shipping_ships', columnName: 'id', dataType: 'uuid', isNullable: 'NO' },
      { tableName: 'shipping_ships', columnName: 'name', dataType: 'character varying', isNullable: 'NO' },
      { tableName: 'shipping_ships', columnName: 'imo', dataType: 'character varying', isNullable: 'NO' },
      { tableName: 'shipping_ships', columnName: 'dwt', dataType: 'integer', isNullable: 'YES' },
    ]

    const report = compareSchemaMappings(mysqlMetadata, pgColumns)
    const shipsGap = report.find((item) => item.mysqlTable === 'ship_info')

    expect(shipsGap).toBeDefined()
    expect(shipsGap?.insertCount).toBe(1)
    expect(shipsGap?.pgTable).toBe('shipping_ships')
    expect(shipsGap?.missingPgFields).toContain('gross_tonnage')
    expect(shipsGap?.missingPgFields).toContain('flag_state')
    expect(shipsGap?.mappedFields).toContain('ship_name→name')
    expect(shipsGap?.mappedFields).toContain('imo_number→imo')
  })

  it('renders a markdown report with blocking gaps', () => {
    const markdown = renderMarkdownReport([
      {
        mysqlTable: 'ship_info',
        pgTable: 'shipping_ships',
        insertCount: 37,
        mysqlColumns: ['ship_name', 'gross_tonnage'],
        pgColumns: ['name'],
        mappedFields: ['ship_name→name'],
        missingPgFields: ['gross_tonnage'],
        extraPgFields: [],
        status: 'partial',
        blockingGaps: ['missing gross_tonnage'],
      },
    ])

    expect(markdown).toContain('| ship_info | shipping_ships | partial | 37 |')
    expect(markdown).toContain('missing gross_tonnage')
  })
})
