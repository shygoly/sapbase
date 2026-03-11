import { ShippingReportPage } from '@/components/shipping/report-page'

export default function fueleuPage() {
  return (
    <ShippingReportPage
      title='FuelEU Dashboard'
      description='GHG target vs actual, pooling indicator and annual detail.'
      reportKey='fueleu'
    />
  )
}
