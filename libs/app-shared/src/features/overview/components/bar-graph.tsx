'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../components/ui/card';

export function BarGraph() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Order volume</CardTitle>
        <CardDescription>Last 3 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='border-border text-muted-foreground flex h-[250px] items-center justify-center rounded-md border border-dashed text-[13px]'>
          Chart data source not connected
        </div>
      </CardContent>
    </Card>
  );
}
