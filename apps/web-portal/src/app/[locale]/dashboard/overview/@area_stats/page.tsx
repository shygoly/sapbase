import { delay } from '@sap/app-shared/constants/mock-api';
import { AreaGraph } from '@sap/app-shared/features/overview/components/area-graph';

export default async function AreaStats() {
  await await delay(2000);
  return <AreaGraph />;
}
