/**
 * 会话流条目。交互面只活在这份内存数组里：
 * 没有 path / url，也不能登记进导航。
 */

import {
  bindEphemeralSurface,
  canBookmarkSurface,
  canNavigateToSurface,
  surfaceHref,
  type EphemeralSurfaceBinding,
} from '@/core/interaction/surface'
import type { InteractionPlan } from '@/core/interaction/plan-decision'

export type ChatUserMessage = {
  id: string
  role: 'user'
  text: string
}

export type ChatAssistantMessage = {
  id: string
  role: 'assistant'
  text: string
}

export type ChatSurfaceEntry = EphemeralSurfaceBinding & {
  id: string
  role: 'surface'
  plan: unknown
}

export type ChatEntry = ChatUserMessage | ChatAssistantMessage | ChatSurfaceEntry

export function newChatEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function userMessage(text: string): ChatUserMessage {
  return { id: newChatEntryId(), role: 'user', text }
}

export function assistantMessage(text: string): ChatAssistantMessage {
  return { id: newChatEntryId(), role: 'assistant', text }
}

export function surfaceEntry(plan: InteractionPlan | unknown): ChatSurfaceEntry {
  const binding = bindEphemeralSurface()
  const navigable: false = canNavigateToSurface(binding)
  const bookmarkable: false = canBookmarkSurface(binding)
  const href: null = surfaceHref(binding)
  return {
    id: newChatEntryId(),
    role: 'surface',
    plan,
    ...binding,
    navigable,
    bookmarkable,
    href,
  }
}

export function dismissSurface(
  entries: ChatEntry[],
  surfaceId: string,
): ChatEntry[] {
  return entries.filter((entry) => entry.id !== surfaceId)
}

export function isSurfaceEntry(entry: ChatEntry): entry is ChatSurfaceEntry {
  return entry.role === 'surface'
}
