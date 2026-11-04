import { ShippingReportPage } from '@sap/app-shared/components/shipping/report-page'

export default function scenario_analysisPage() {
  return (
    <ShippingReportPage
      title='Scenario Analysis'
      description='Compare fuel mix and compliance cost scenarios with unified metrics.'
      reportKey='scenario-analysis'
    />
  )
}
