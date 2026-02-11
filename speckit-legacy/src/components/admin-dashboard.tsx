'use client'

import { useAuth } from '@/core/auth/context'
import { PermissionGate } from '@/components/permission-gate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, Building2, FileText } from 'lucide-react'

export function AdminDashboard() {
  const { user } = useAuth()

  const stats = [
    {
      title: 'Users',
      icon: Users,
      permission: 'users:read',
      href: '/admin/users',
    },
    {
      title: 'Roles',
      icon: Shield,
      permission: 'roles:read',
      href: '/admin/roles',
    },
    {
      title: 'Departments',
      icon: Building2,
      permission: 'departments:read',
      href: '/admin/departments',
    },
    {
      title: 'Audit Logs',
      icon: FileText,
      permission: 'audit-logs:read',
      href: '/admin/audit-logs',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground">
          Role: <span className="font-medium capitalize">{user?.role}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <PermissionGate key={stat.title} permission={stat.permission}>
            <a href={stat.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">→</div>
                  <p className="text-xs text-muted-foreground">Click to manage</p>
                </CardContent>
              </Card>
            </a>
          </PermissionGate>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <PermissionGate permission="users:create">
            <a href="/admin/users" className="block text-sm text-blue-600 hover:underline">
              + Create New User
            </a>
          </PermissionGate>
          <PermissionGate permission="roles:create">
            <a href="/admin/roles" className="block text-sm text-blue-600 hover:underline">
              + Create New Role
            </a>
          </PermissionGate>
          <PermissionGate permission="departments:create">
            <a href="/admin/departments" className="block text-sm text-blue-600 hover:underline">
              + Create New Department
            </a>
          </PermissionGate>
        </CardContent>
      </Card>
    </div>
  )
}
