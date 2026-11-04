'use client'

import { useState } from 'react'
import { Switch } from '@sap/ui-kit/switch'

export function StatusSwitchCell({ defaultChecked = true }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className='flex items-center justify-end gap-2'>
      <span className='text-xs font-medium text-slate-500'>{checked ? 'On' : 'Off'}</span>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  )
}
