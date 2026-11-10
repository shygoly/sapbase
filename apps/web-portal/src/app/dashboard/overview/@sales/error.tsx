'use client';

import { Alert, AlertDescription, AlertTitle } from '@sap/app-shared/components/ui/alert';

export default function SalesError({ error }: { error: Error }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Failed to load sales data: {error.message}
      </AlertDescription>
    </Alert>
  );
}
