'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function OverviewError({ error }: { error: Error }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Failed to load statistics: {error.message}
      </AlertDescription>
    </Alert>
  );
}
