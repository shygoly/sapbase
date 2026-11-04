'use client';

import { Alert, AlertDescription, AlertTitle } from '@sap/app-shared/components/ui/alert';

export default function BarStatsError({ error }: { error: Error }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Failed to load bar statistics: {error.message}
      </AlertDescription>
    </Alert>
  );
}
