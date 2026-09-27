'use client'

import { useState, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTranslation } from '@/i18n'
import {
  ACTION_KINDS,
  BLOCK_KINDS,
  decidePlanRenderable,
  type AnomalyBlock,
  type ConfirmAction,
  type EditAction,
  type FactsBlock,
  type InteractionPlan,
  type LinesBlock,
  type PlanAction,
  type PlanBlock,
  type TableBlock,
} from './plan-decision'
import { bindEphemeralSurface } from './surface'

export type PlanActionEvent =
  | { kind: 'confirm'; action: ConfirmAction }
  | { kind: 'cancel'; action: { kind: 'cancel'; id: string; label: string } }
  | { kind: 'edit'; action: EditAction }

export interface PlanRendererProps {
  plan: unknown
  pendingActionId?: string | null
  onAction?: (event: PlanActionEvent) => void
}

function asPlan(plan: unknown): InteractionPlan {
  return plan as InteractionPlan
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function FactsView({ block }: { block: FactsBlock }) {
  const items = Array.isArray(block.items) ? block.items : []
  return (
    <dl className='grid grid-cols-[minmax(6rem,30%)_1fr] gap-x-4 gap-y-2 text-sm'>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className='contents'>
          <dt className='text-muted-foreground'>{item.label}</dt>
          <dd className='font-medium break-all'>{formatCell(item.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function LinesView({ block }: { block: LinesBlock }) {
  const items = Array.isArray(block.items) ? block.items : []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Ref</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.label}-${index}`}>
            <TableCell>{item.label}</TableCell>
            <TableCell>{formatCell(item.quantity)}</TableCell>
            <TableCell>{item.unit ?? ''}</TableCell>
            <TableCell>{item.reference ?? ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AnomalyView({ block }: { block: AnomalyBlock }) {
  const destructive = block.severity === 'danger'
  return (
    <Alert variant={destructive ? 'destructive' : 'default'}>
      <AlertTitle className='flex items-center gap-2'>
        <Badge variant={destructive ? 'destructive' : 'outline'}>
          {block.severity}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <p>{block.message}</p>
        {block.detail ? (
          <p className='text-muted-foreground mt-1'>{block.detail}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function TableView({ block }: { block: TableBlock }) {
  const columns = Array.isArray(block.columns) ? block.columns : []
  const rows = Array.isArray(block.rows) ? block.rows : []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((_, colIndex) => (
              <TableCell key={`${rowIndex}-${colIndex}`}>
                {formatCell(row?.[colIndex])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function renderKnownBlock(
  block: PlanBlock,
  index: number,
): { ok: true; node: ReactNode } | { ok: false; unknownKind: string } {
  switch (block.kind) {
    case 'facts':
      return { ok: true, node: <FactsView key={`facts-${index}`} block={block} /> }
    case 'lines':
      return { ok: true, node: <LinesView key={`lines-${index}`} block={block} /> }
    case 'anomaly':
      return {
        ok: true,
        node: <AnomalyView key={`anomaly-${index}`} block={block} />,
      }
    case 'table':
      return { ok: true, node: <TableView key={`table-${index}`} block={block} /> }
    default: {
      const kind = String((block as { kind?: unknown }).kind ?? '(missing)')
      return { ok: false, unknownKind: kind }
    }
  }
}

function EditFields({ action }: { action: EditAction }) {
  const t = useTranslation()
  const fields = Array.isArray(action.fields) ? action.fields : []
  return (
    <div className='space-y-3 rounded-md border p-3'>
      <p className='text-sm font-medium'>{t('chat.editFields')}</p>
      <p className='text-muted-foreground text-xs'>{t('chat.editNoSubmit')}</p>
      {fields.map((field) => (
        <div key={field} className='space-y-1'>
          <Label htmlFor={`edit-${action.id}-${field}`}>{field}</Label>
          <Input
            id={`edit-${action.id}-${field}`}
            name={field}
            readOnly
            value=''
          />
        </div>
      ))}
    </div>
  )
}

function ActionButtons({
  actions,
  pendingActionId,
  onAction,
}: {
  actions: PlanAction[]
  pendingActionId?: string | null
  onAction?: (event: PlanActionEvent) => void
}) {
  const t = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = actions.find(
    (action): action is EditAction =>
      action.kind === 'edit' && action.id === editingId,
  )

  return (
    <div className='flex w-full flex-col gap-3'>
      {editing ? <EditFields action={editing} /> : null}
      <div className='flex flex-wrap gap-2'>
        {actions.map((action) => {
          const busy = pendingActionId === action.id
          if (action.kind === 'confirm') {
            return (
              <Button
                key={action.id}
                type='button'
                disabled={busy || !!pendingActionId}
                onClick={() => onAction?.({ kind: 'confirm', action })}
              >
                {busy ? t('chat.confirming') : action.label}
              </Button>
            )
          }
          if (action.kind === 'edit') {
            const open = editingId === action.id
            return (
              <Button
                key={action.id}
                type='button'
                variant='outline'
                disabled={!!pendingActionId}
                onClick={() => {
                  setEditingId(open ? null : action.id)
                  onAction?.({ kind: 'edit', action })
                }}
              >
                {action.label}
              </Button>
            )
          }
          if (action.kind === 'cancel') {
            return (
              <Button
                key={action.id}
                type='button'
                variant='ghost'
                disabled={!!pendingActionId}
                onClick={() => onAction?.({ kind: 'cancel', action })}
              >
                {action.label}
              </Button>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

function PlanRejection({
  reason,
  unknownKind,
}: {
  reason: string
  unknownKind: string
}) {
  const t = useTranslation()
  return (
    <Alert variant='destructive'>
      <AlertTitle>{t('chat.planRejected')}</AlertTitle>
      <AlertDescription>
        <p>{reason}</p>
        <p className='mt-2'>
          {t('chat.unknownKind', { kind: unknownKind })}
        </p>
        <p className='text-muted-foreground mt-2 text-xs'>
          blocks: {BLOCK_KINDS.join(' / ')}; actions: {ACTION_KINDS.join(' / ')}
        </p>
      </AlertDescription>
    </Alert>
  )
}

export function PlanRenderer({
  plan,
  pendingActionId,
  onAction,
}: PlanRendererProps) {
  const t = useTranslation()
  const decision = decidePlanRenderable(plan)
  if (!decision.ok) {
    return (
      <PlanRejection
        reason={decision.reason}
        unknownKind={decision.unknownKind}
      />
    )
  }

  const renderable = asPlan(plan)
  const nodes: ReactNode[] = []
  for (let index = 0; index < renderable.blocks.length; index += 1) {
    const rendered = renderKnownBlock(renderable.blocks[index], index)
    if (!rendered.ok) {
      return (
        <PlanRejection
          reason={
            `未知的 block 类型「${rendered.unknownKind}」` +
            `（封闭枚举：${BLOCK_KINDS.join(' / ')}）—— 渲染器必须整份拒绝，不能跳过未知部分`
          }
          unknownKind={rendered.unknownKind}
        />
      )
    }
    nodes.push(rendered.node)
  }

  for (const action of renderable.actions) {
    if (
      action.kind !== 'confirm' &&
      action.kind !== 'edit' &&
      action.kind !== 'cancel'
    ) {
      const kind = String((action as { kind?: unknown }).kind ?? '(missing)')
      return (
        <PlanRejection
          reason={
            `未知的动作类型「${kind}」` +
            `（封闭枚举：${ACTION_KINDS.join(' / ')}）—— 渲染器必须整份拒绝，不能跳过未知部分`
          }
          unknownKind={kind}
        />
      )
    }
  }

  const binding = bindEphemeralSurface()
  const tools = renderable.trace?.tools ?? []

  return (
    <Card data-surface-lifetime={binding.lifetime} data-navigable='false'>
      <CardHeader>
        <CardTitle>{renderable.title}</CardTitle>
        <CardDescription>{t('chat.ephemeralNote')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {nodes}
        {tools.length > 0 ? (
          <p className='text-muted-foreground text-xs'>
            {t('chat.trace')}: {tools.join(', ')}
          </p>
        ) : null}
      </CardContent>
      <CardFooter>
        <ActionButtons
          actions={renderable.actions}
          pendingActionId={pendingActionId}
          onAction={onAction}
        />
      </CardFooter>
    </Card>
  )
}
