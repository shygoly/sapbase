import type { ReactNode } from 'react'

/** 通用下拉/选项结构，与后端 constants 接口对齐。 */
export interface ShippingOption {
  label: string
  value: string
}

/** 船舶主数据。后端同时返回 rating / ciiRating 两种命名，前端做兼容映射。 */
export interface ShipRecord {
  id: string
  name: string
  imo?: string
  type?: string
  status?: string
  rating?: string
  ciiRating?: string
  dwt?: number
  speed?: number
}

/** 租船期合同。 */
export interface CharterRecord {
  id: string
  vesselName: string
  charterer: string
  startDate: string
  endDate: string
  status?: string
  allocation?: string
}

/** 航次记录。 */
export interface VoyageRecord {
  id: string
  voyageNo: string
  vesselName: string
  departurePort: string
  arrivalPort: string
  distanceNm: number
  emissions?: number
  throughIce?: string
  status?: string
}

/** 年度参数（CII / FuelEU / ETS 的年度基准）。 */
export interface YearParameterRecord {
  id: string
  year: number
  fuelEuTarget: number
  etsCoverageRatio: number
  euaPrice: number
}

/** 燃料类型主数据。 */
export interface FuelTypeRecord {
  id: string
  name: string
  code?: string
  scope: 'system' | 'tenant'
  lcv: number
  co2Factor: number
  defaultPrice?: number
  price?: number
  status?: string
}

/** CII 船型参数。 */
export interface CiiShipTypeParameterRecord {
  id: string
  shipType: string
  applicableStandard: string
  rangeMin: number
  rangeMax?: number | null
  referenceCii: number
  requiredCii: number
  d1: number
  d2: number
  d3: number
  d4: number
  correctionFactor: number
}

export type MetricCardTone = 'default' | 'success' | 'warning' | 'danger'

/** 指标卡：label/value 必填，tone 决定配色。 */
export interface MetricCardValue {
  label: string
  value: string
  trend?: string
  tone?: MetricCardTone
}

export interface DonutPoint {
  name: string
  value: number
  color: string
}

export interface TrendPoint {
  month: string
  actual: number
  target?: number
  forecast?: number
}

/** 表格列定义；key 允许是行数据之外的伪列（如 __actions__）。 */
export interface TableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render?: (row: T) => ReactNode
}

/** 报表载荷：指标 + 趋势 + 环形图 + 明细行。 */
export interface ShippingReportPayload<T> {
  metrics: MetricCardValue[]
  trend: TrendPoint[]
  donut?: DonutPoint[]
  rows: T[]
}

/** 报表中心导出记录。 */
export interface ReportCenterRecord {
  id: string
  reportType: string
  vesselName: string
  year: number
  exportedAt: string
  exportedBy: string
  parameters: string
  fileName: string
  downloadUrl?: string
}

/** 航次导入逐行结果。 */
export interface VoyageImportRow {
  rowNumber: number
  status: string
  voyageStatus?: string
  errors?: string[]
}

/** 航次导入结果汇总。 */
export interface VoyageImportResult {
  summary: {
    totalRows: number
    successCount: number
    failureCount: number
  }
  rows: VoyageImportRow[]
}
