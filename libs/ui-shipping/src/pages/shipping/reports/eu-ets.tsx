import { ShippingReportPage } from '@sap/ui-shipping/components/shipping/report-page'

export default function eu_etsPage() {
  return (
    <ShippingReportPage
      title='EU ETS Dashboard'
      description='YTD / forecast emissions, EUA requirement and allocation trend.'
      reportKey='eu-ets'
    />
  )
}
