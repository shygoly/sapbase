import { redirect } from 'next/navigation'
import { defaultLocale } from '@sap/app-shared/i18n/config'

export default function RootPage() {
  redirect(`/${defaultLocale}/dashboard/overview`)
}
