'use client'

import { Mail, Pin, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@sap/ui-kit/badge'
import { Button } from '@sap/ui-kit/button'
import { Input } from '@sap/ui-kit/input'
import { Popover, PopoverContent, PopoverTrigger } from '@sap/ui-kit/popover'
import { ScrollArea } from '@sap/ui-kit/scroll-area'

const MOCK_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'Compliance Bot',
    subject: 'FuelEU variance updated',
    preview: 'MV Aurora has a new FuelEU variance snapshot ready for review.',
    time: '2 min ago',
    unread: true,
    pinned: true,
  },
  {
    id: 'msg-2',
    sender: 'Ops Desk',
    subject: 'Voyage import completed',
    preview: '27 voyage rows were processed for legacy-tenant-5.',
    time: '15 min ago',
    unread: true,
    pinned: false,
  },
  {
    id: 'msg-3',
    sender: 'Report Center',
    subject: 'Export package archived',
    preview: 'The latest CII report bundle is now available in Report Center.',
    time: '1 hour ago',
    unread: false,
    pinned: false,
  },
]

export function MessageCenter() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const messages = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return MOCK_MESSAGES
    return MOCK_MESSAGES.filter((message) =>
      [message.sender, message.subject, message.preview].some((field) =>
        field.toLowerCase().includes(normalized),
      ),
    )
  }, [query])

  const unreadCount = MOCK_MESSAGES.filter((item) => item.unread).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-label='Message Center' variant='ghost' size='icon' className='relative rounded-full'>
          <Mail className='h-5 w-5' />
          {unreadCount > 0 ? (
            <Badge
              variant='secondary'
              className='absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]'
            >
              {unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[360px] p-0'>
        <div className='border-b px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-sm font-semibold'>Message Center</div>
              <div className='text-xs text-muted-foreground'>Pinned operational updates and inbox previews</div>
            </div>
            <Badge variant='outline'>{unreadCount} unread</Badge>
          </div>
          <div className='relative mt-3'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              className='pl-9'
              placeholder='Search messages'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <ScrollArea className='h-[360px]'>
          <div className='space-y-2 p-3'>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl border p-3 transition-colors ${
                  message.unread ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='truncate text-sm font-medium'>{message.sender}</span>
                      {message.pinned ? <Pin className='h-3.5 w-3.5 text-primary' /> : null}
                    </div>
                    <div className='mt-1 text-sm font-semibold'>{message.subject}</div>
                    <div className='mt-1 line-clamp-2 text-xs text-muted-foreground'>{message.preview}</div>
                  </div>
                  <span className='shrink-0 text-[11px] text-muted-foreground'>{message.time}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
