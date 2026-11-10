'use client'

import { useAuthStore } from '../../../core/store'
import { useOrganizationStore } from '../../../core/store/organization.store'

export default function ProfileViewPage() {
  const user = useAuthStore((state) => state.user)
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)

  const rows: Array<[string, string]> = [
    ['Name', user?.name ?? '—'],
    ['Email', user?.email ?? '—'],
    ['Role', user?.roleName ?? user?.role ?? '—'],
    ['Department', user?.departmentName ?? '—'],
    ['Organization', currentOrganization?.name ?? '—'],
    ['Permissions', String(user?.permissions?.length ?? 0)],
  ]

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <h1 className='font-serif text-[26px] leading-tight font-semibold tracking-[-0.015em]'>
        Profile
      </h1>
      <p className='mt-1 text-[13px] text-muted-foreground'>
        Account details and organization membership.
      </p>

      <div className='mt-6 overflow-hidden rounded-lg border border-border bg-card'>
        <dl>
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={`grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 text-[13px] ${
                index > 0 ? 'border-t border-border' : ''
              }`}
            >
              <dt className='text-muted-foreground'>{label}</dt>
              <dd className='font-medium'>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className='mt-4 text-[11px] text-muted-foreground'>
        Profile fields are managed by your administrator.
      </p>
    </div>
  )
}
