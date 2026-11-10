'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../components/ui/card';

export function PieGraph() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Document status</CardTitle>
        <CardDescription>Pending · Approved · Rejected</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='border-border text-muted-foreground flex h-[250px] items-center justify-center rounded-md border border-dashed text-[13px]'>
          Chart data source not connected
        </div>
      </CardContent>
    </Card>
  );
}
