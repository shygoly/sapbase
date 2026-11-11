'use client'

import Link from 'next/link'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sap/app-shared/components/ui/card'

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL || 'http://localhost:3060'

const ITEMS = [
  {
    title: '组织与品牌',
    description: '应用名称、支持邮箱、品牌色与 Logo（Portal 内维护）',
    href: '/dashboard/settings/organization',
  },
  {
    title: '成员与角色',
    description: '邀请成员、分配角色（过渡期双挂 Console）',
    href: `${CONSOLE_URL}/admin/users`,
    external: true,
  },
  {
    title: '部门',
    description: '组织架构与部门维护（过渡期双挂 Console）',
    href: `${CONSOLE_URL}/admin/departments`,
    external: true,
  },
  {
    title: '菜单',
    description: '菜单可见性、台面与交互标识（过渡期双挂 Console）',
    href: `${CONSOLE_URL}/admin/menu`,
    external: true,
  },
]

export default function OrganizationSettingsPage() {
  return (
    <PageContainer
      pageTitle='组织设置'
      pageDescription='租户自助入口收敛到 Portal；平台治理项仍在 Console（过渡期双挂）。'
    >
      <div className='grid gap-4 md:grid-cols-2'>
        {ITEMS.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {item.external ? (
                <a className='text-primary text-sm underline-offset-4 hover:underline' href={item.href}>
                  打开管理页
                </a>
              ) : (
                <Link className='text-primary text-sm underline-offset-4 hover:underline' href={item.href}>
                  进入设置
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}
