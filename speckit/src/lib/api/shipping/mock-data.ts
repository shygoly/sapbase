import type {
  CharterRecord,
  DonutPoint,
  MetricCardValue,
  ReportCenterRecord,
  ShipRecord,
  ShippingOption,
  ShippingReportPayload,
  TrendPoint,
  VoyageRecord,
} from './types'

export const ships: ShipRecord[] = [
  { id: 'aurora', name: 'MV Aurora', imo: '9812345', type: 'Container', status: 'Active', rating: 'B', dwt: 84500, speed: 15.4 },
  { id: 'nebula', name: 'MV Nebula', imo: '9823456', type: 'Bulk Carrier', status: 'Active', rating: 'C', dwt: 78600, speed: 14.7 },
  { id: 'atlas', name: 'MV Atlas', imo: '9834567', type: 'Tanker', status: 'Planned', rating: 'A', dwt: 90500, speed: 13.9 },
]

export const years: ShippingOption[] = [
  { label: '2024', value: '2024' },
  { label: '2025', value: '2025' },
  { label: '2026', value: '2026' },
]

export const shipOptions: ShippingOption[] = ships.map((ship) => ({
  label: ship.name,
  value: ship.id,
}))

export const charters: CharterRecord[] = [
  { id: 'c1', vesselName: 'MV Aurora', charterer: 'Ocean Leasing BV', startDate: '2025-01-01', endDate: '2025-06-30', status: 'Claimed', allocation: 'Time Charter 68%' },
  { id: 'c2', vesselName: 'MV Aurora', charterer: 'Harbor Lines Ltd', startDate: '2025-07-01', endDate: '2025-12-31', status: 'Claimed', allocation: 'Time Charter 71%' },
  { id: 'c3', vesselName: 'MV Nebula', charterer: 'Polar Trade GmbH', startDate: '2025-03-15', endDate: '2025-10-30', status: 'Pending', allocation: 'Time Charter 55%' },
]

export const voyages: VoyageRecord[] = [
  { id: 'v1', voyageNo: 'VOY-2401', vesselName: 'MV Aurora', departurePort: 'Shanghai', arrivalPort: 'Rotterdam', distanceNm: 10874, emissions: 3250.4, throughIce: 'No', status: 'CLAIMED' },
  { id: 'v2', voyageNo: 'VOY-2402', vesselName: 'MV Aurora', departurePort: 'Rotterdam', arrivalPort: 'Hamburg', distanceNm: 282, emissions: 142.6, throughIce: 'No', status: 'CLAIMED' },
  { id: 'v3', voyageNo: 'VOY-2403', vesselName: 'MV Nebula', departurePort: 'Oslo', arrivalPort: 'Reykjavík', distanceNm: 977, emissions: 311.8, throughIce: 'Yes', status: 'UNCLAIMED' },
]

const overviewTrend: TrendPoint[] = [
  { month: 'Jan', actual: 210, target: 225, forecast: 230 },
  { month: 'Feb', actual: 205, target: 220, forecast: 228 },
  { month: 'Mar', actual: 201, target: 218, forecast: 226 },
  { month: 'Apr', actual: 198, target: 215, forecast: 223 },
  { month: 'May', actual: 194, target: 212, forecast: 220 },
  { month: 'Jun', actual: 191, target: 210, forecast: 218 },
]

const allocationDonut: DonutPoint[] = [
  { name: 'Fuel', value: 48, color: '#0f766e' },
  { name: 'EU ETS', value: 22, color: '#0ea5e9' },
  { name: 'FuelEU Penalty', value: 18, color: '#f59e0b' },
  { name: 'Pooling', value: 12, color: '#8b5cf6' },
]

const monthlyRows = [
  { month: 'Jan', attained: '4.21', required: '4.56', warning: 'Normal', emissions: '1,842', euaRequired: '1,289', ghgDifference: '-4.2%', penalty: '€25,320' },
  { month: 'Feb', attained: '4.18', required: '4.50', warning: 'Normal', emissions: '1,755', euaRequired: '1,228', ghgDifference: '-4.8%', penalty: '€24,910' },
  { month: 'Mar', attained: '4.12', required: '4.42', warning: 'Watch', emissions: '1,690', euaRequired: '1,183', ghgDifference: '-5.4%', penalty: '€24,105' },
  { month: 'Apr', attained: '4.08', required: '4.35', warning: 'Watch', emissions: '1,621', euaRequired: '1,135', ghgDifference: '-6.1%', penalty: '€23,540' },
]

export const reportData: Record<string, ShippingReportPayload<Record<string, string>>> = {
  cii: {
    metrics: [
      { label: 'CII Rating', value: 'B', trend: '+1 level', tone: 'success' },
      { label: 'YTD Attained CII', value: '4.08', trend: '-3.4%' },
      { label: 'Required CII', value: '4.35', trend: '2025 target' },
      { label: 'AER', value: '4.67', trend: '-2.1%' },
    ],
    trend: overviewTrend,
    donut: [
      { name: 'A/B', value: 64, color: '#10b981' },
      { name: 'C', value: 26, color: '#f59e0b' },
      { name: 'D/E', value: 10, color: '#ef4444' },
    ],
    rows: monthlyRows,
  },
  fueleu: {
    metrics: [
      { label: 'GHG Target', value: '89.0 gCO₂e/MJ', trend: '2025 baseline' },
      { label: 'GHG Actual', value: '84.1 gCO₂e/MJ', trend: '-5.5%', tone: 'success' },
      { label: 'GHG Difference', value: '-4.9 gCO₂e/MJ', trend: 'Ahead of target', tone: 'success' },
      { label: 'Expected Penalty', value: '€124,880', trend: '-12.0%' },
    ],
    trend: overviewTrend,
    donut: [
      { name: 'Compliant', value: 78, color: '#10b981' },
      { name: 'At Risk', value: 14, color: '#f59e0b' },
      { name: 'Over', value: 8, color: '#ef4444' },
    ],
    rows: monthlyRows,
  },
  'eu-ets': {
    metrics: [
      { label: 'YTD Emissions', value: '12,554.35 tCO₂eq', trend: '+4.2%' },
      { label: 'YTD EUA Required', value: '8,788.05', trend: 'ETS × 0.7' },
      { label: 'Forecast Emissions', value: '24,809.70', trend: 'FY 2025' },
      { label: 'Forecast EUA Required', value: '17,366.79', trend: 'Buy window open' },
    ],
    trend: overviewTrend,
    donut: [
      { name: 'Spot', value: 52, color: '#0ea5e9' },
      { name: 'Forward', value: 31, color: '#1d4ed8' },
      { name: 'Reserved', value: 17, color: '#94a3b8' },
    ],
    rows: monthlyRows,
  },
  'fuel-cost': {
    metrics: [
      { label: 'Average Cost / t', value: '$782', trend: '+2.4%' },
      { label: 'Total Fuel Cost', value: '$5.82M', trend: '+1.9%' },
      { label: 'ETS Included', value: '$1.26M', trend: '+0.8%' },
      { label: 'FuelEU Penalty', value: '$0.43M', trend: '-6.2%', tone: 'success' },
    ],
    trend: overviewTrend,
    donut: allocationDonut,
    rows: monthlyRows,
  },
  'home-overview': {
    metrics: [
      { label: 'Ship Count', value: '1', trend: 'Selected fleet' },
      { label: 'Voyage Distance (NM)', value: '49,807.9', trend: '+8.1%' },
      { label: 'CO₂ Emissions', value: '12,554.35', trend: '+4.2%' },
      { label: 'Forecast Compliance Cost', value: '€1.82M', trend: '-3.8%', tone: 'success' },
    ],
    trend: overviewTrend,
    donut: allocationDonut,
    rows: monthlyRows,
  },
  'scenario-analysis': {
    metrics: [
      { label: 'Scenario', value: 'Balanced Blend', trend: '3-path comparison' },
      { label: 'EUA Forecast', value: '€0.94M', trend: '-7.2%', tone: 'success' },
      { label: 'FuelEU Penalty', value: '€0.31M', trend: '-14.8%', tone: 'success' },
      { label: 'GHG Difference', value: '-6.3%', trend: 'Best candidate', tone: 'success' },
    ],
    trend: overviewTrend,
    donut: allocationDonut,
    rows: monthlyRows,
  },
}

export const reportCenter: ReportCenterRecord[] = [
  { id: 'r1', reportType: 'CII Dashboard', vesselName: 'MV Aurora', year: 2025, exportedAt: '2026-03-10 09:18', exportedBy: 'Admin User', parameters: 'Ship=MV Aurora; Year=2025', fileName: 'cii-dashboard-2025-aurora.xlsx' },
  { id: 'r2', reportType: 'FuelEU Dashboard', vesselName: 'MV Aurora', year: 2025, exportedAt: '2026-03-10 09:32', exportedBy: 'Admin User', parameters: 'Ship=MV Aurora; Year=2025', fileName: 'fueleu-dashboard-2025-aurora.xlsx' },
  { id: 'r3', reportType: 'Home Overview', vesselName: 'MV Nebula', year: 2025, exportedAt: '2026-03-10 10:01', exportedBy: 'Manager User', parameters: 'Ship=MV Nebula; Year=2025', fileName: 'home-overview-2025-nebula.xlsx' },
]

export const reportTypeOptions: ShippingOption[] = [
  { label: 'CII Dashboard', value: 'CII Dashboard' },
  { label: 'FuelEU Dashboard', value: 'FuelEU Dashboard' },
  { label: 'EU ETS Dashboard', value: 'EU ETS Dashboard' },
  { label: 'Fuel Cost', value: 'Fuel Cost' },
  { label: 'Home Overview', value: 'Home Overview' },
]

export const loginDemoUsers = [
  { tenantCode: 'demo003', username: 'demo003', password: 'demo003' },
  { tenantCode: 'tenant-a', username: 'admin@example.com', password: '123456' },
]
