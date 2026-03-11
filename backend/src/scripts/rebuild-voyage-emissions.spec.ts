import { buildVoyageEmissionRows } from './rebuild-voyage-emissions'

describe('rebuild-voyage-emissions', () => {
  it('calculates voyage emissions from tenant and system fuel factors', () => {
    const voyageRows = [
      { id: 'voy-1', organizationId: 'org-1' },
      { id: 'voy-2', organizationId: 'org-2' },
    ]
    const fuelRows = [
      { voyageId: 'voy-1', fuelCode: 'VLSFO', consumption: 10 },
      { voyageId: 'voy-1', fuelCode: 'MGO', consumption: 2 },
      { voyageId: 'voy-2', fuelCode: 'HFO-01', consumption: 3 },
    ]
    const systemFuelFactors = new Map([
      ['VLSFO', 3.114],
      ['MGO', 3.206],
    ])
    const tenantFuelFactors = new Map([
      ['org-2:HFO-01', 2.5],
    ])

    const rows = buildVoyageEmissionRows(voyageRows, fuelRows, systemFuelFactors, tenantFuelFactors)

    expect(rows).toEqual([
      { voyageId: 'voy-1', emissions: 37.552 },
      { voyageId: 'voy-2', emissions: 7.5 },
    ])
  })
})
