import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className='gap-3 border-slate-200 bg-white py-4 shadow-sm'>
      <CardHeader className='px-5 pb-0'>
        <CardTitle className='text-base font-semibold text-slate-950'>{title}</CardTitle>
        {description ? <p className='text-sm text-slate-500'>{description}</p> : null}
      </CardHeader>
      <CardContent className='px-5'>{children}</CardContent>
    </Card>
  )
}
