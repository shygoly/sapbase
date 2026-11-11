'use client'

import React, { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ConfirmDialog } from '@sap/ui-kit/confirm-dialog'

export interface WorkbenchSelection {
  selectedId: string | null
  select: (id: string | null, options?: { replace?: boolean }) => void
  clear: () => void
}

/** 选中实体与 URL 同步（默认 ?id=），刷新后可恢复。 */
export function useWorkbenchSelection(options: {
  param?: string
  enabled?: boolean
} = {}): WorkbenchSelection {
  const param = options.param ?? 'id'
  const enabled = options.enabled ?? true
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = enabled ? searchParams.get(param) : null

  const select = useCallback(
    (id: string | null, opts: { replace?: boolean } = {}) => {
      if (!enabled) return
      const next = new URLSearchParams(searchParams.toString())
      if (id) next.set(param, id)
      else next.delete(param)
      const suffix = next.toString() ? `?${next.toString()}` : ''
      const url = `${pathname}${suffix}`
      if (opts.replace) router.replace(url)
      else router.push(url)
    },
    [enabled, param, pathname, router, searchParams],
  )

  return { selectedId, select, clear: () => select(null) }
}

export interface DirtySelectionGuard {
  /** 切换选中；脏数据时先确认。 */
  requestSelect: (id: string | null) => void
  dialog: React.ReactNode
}

/**
 * 详情脏数据时切换选中须确认。
 * 确认框与实际选中解耦，调用方只使用 requestSelect + dialog。
 */
export function useDirtySelectionGuard(input: {
  isDirty: boolean
  select: (id: string | null) => void
  message?: string
}): DirtySelectionGuard {
  const [pending, setPending] = useState<{ id: string | null } | null>(null)

  const requestSelect = (id: string | null) => {
    if (!input.isDirty) {
      input.select(id)
      return
    }
    setPending({ id })
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null)
      }}
      onConfirm={() => {
        if (pending) input.select(pending.id)
        setPending(null)
      }}
      title='有未保存修改'
      description={input.message ?? '切换选中会丢失当前修改，确定继续？'}
      confirmText='放弃修改'
      cancelText='继续编辑'
    />
  )

  return { requestSelect, dialog }
}

export interface WorkbenchLayoutProps {
  list: React.ReactNode
  detail: React.ReactNode
  selectedId?: string | null
  /** 窄屏返回列表的路由；默认清空 ?id=。 */
  backHref?: string
  mode?: 'stack' | 'master-detail'
  listClassName?: string
  detailClassName?: string
}

/**
 * 工作台原语：
 * - stack：上下；
 * - master-detail：宽屏左右，窄屏列表 → 独立详情（保留 URL id 语义）。
 */
export function WorkbenchLayout({
  list,
  detail,
  selectedId,
  backHref,
  mode = 'stack',
  listClassName = '',
  detailClassName = '',
}: WorkbenchLayoutProps) {
  if (mode === 'stack') {
    return (
      <div className='flex flex-col gap-4'>
        <div className={listClassName}>{list}</div>
        <div className={detailClassName}>{detail}</div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 md:flex-row'>
      <div className={`${selectedId ? 'hidden md:block' : ''} md:w-1/2 ${listClassName}`}>
        {list}
      </div>
      <div className={`${selectedId ? '' : 'hidden md:block'} md:w-1/2 ${detailClassName}`}>
        {selectedId && backHref ? (
          <Link
            href={backHref}
            className='text-muted-foreground mb-2 inline-block text-sm md:hidden'
          >
            ← 返回列表
          </Link>
        ) : null}
        {detail}
      </div>
    </div>
  )
}
