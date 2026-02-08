'use client'

import Link from 'next/link'
import { useMenu } from '@/core/menu/hooks'
import { usePermission } from '@/core/auth/hooks'
import { useTranslation } from '@/core/i18n/hooks'
import { ChevronDown } from 'lucide-react'
import * as Icons from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MenuItem } from '@/core/menu/config'

export function Sidebar() {
  const { menu, expandedItems, toggleExpanded, isLoading } = useMenu()
  const { hasPermission } = usePermission()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <aside className="w-64 border-r bg-background p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Speckit</h1>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </aside>
    )
  }

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasAccess = !item.permissions || item.permissions.some((p) => hasPermission(p))
    if (!hasAccess) return null

    const isExpanded = expandedItems.has(item.id)
    const hasChildren = item.children && item.children.length > 0
    const IconComponent = item.icon ? (Icons as any)[item.icon] : null

    return (
      <div key={item.id}>
        {hasChildren ? (
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-2 h-auto font-medium text-foreground hover:bg-accent"
            onClick={() => toggleExpanded(item.id)}
          >
            <div className="flex items-center gap-2">
              {IconComponent && <IconComponent size={18} />}
              <span>{t(item.label)}</span>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2 h-auto font-medium text-foreground hover:bg-accent"
            asChild
          >
            <Link href={item.path || '#'} className="flex items-center gap-2">
              {IconComponent && <IconComponent size={18} />}
              <span>{t(item.label)}</span>
            </Link>
          </Button>
        )}

        {hasChildren && isExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children?.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 border-r bg-background p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Speckit</h1>
      </div>
      <nav className="space-y-1">{menu.items.map((item) => renderMenuItem(item))}</nav>
    </aside>
  )
}
