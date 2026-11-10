'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../components/ui/card';

export function AreaGraph() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Revenue trend</CardTitle>
        <CardDescription>Last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='border-border text-muted-foreground flex h-[250px] items-center justify-center rounded-md border border-dashed text-[13px]'>
          Chart data source not connected
        </div>
      </CardContent>
    </Card>
  );
}
