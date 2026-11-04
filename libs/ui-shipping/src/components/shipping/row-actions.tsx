import { Button } from '@sap/ui-kit/button'

export function RowActions() {
  return (
    <div className='flex items-center justify-end gap-2'>
      <Button variant='outline' size='sm' className='border-slate-200'>View</Button>
      <Button size='sm' className='bg-slate-900 text-white hover:bg-slate-800'>Export</Button>
    </div>
  )
}
