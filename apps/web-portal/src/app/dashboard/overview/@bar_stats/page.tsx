import { delay } from '@sap/app-shared/constants/mock-api';
import { BarGraph } from '@sap/app-shared/features/overview/components/bar-graph';

export default async function BarStats() {
  await await delay(1000);

  return <BarGraph />;
}
