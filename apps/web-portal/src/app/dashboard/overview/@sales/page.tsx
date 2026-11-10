import { delay } from '@sap/app-shared/constants/mock-api';
import { RecentSales } from '@sap/app-shared/features/overview/components/recent-sales';

export default async function Sales() {
  await delay(3000);
  return <RecentSales />;
}
