import { delay } from '@sap/app-shared/constants/mock-api';
import { PieGraph } from '@sap/app-shared/features/overview/components/pie-graph';

export default async function Stats() {
  await delay(1000);
  return <PieGraph />;
}
