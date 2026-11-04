import { ShippingReportPage } from '@sap/ui-shipping/components/shipping/report-page'

export default function ciiPage() {
  return (
    <ShippingReportPage
      title='CII Dashboard'
      description='Required vs attained CII, annual trend and compliance warning.'
      reportKey='cii'
    />
  )
}
