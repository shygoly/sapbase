/**
 * Chat 编排入口。复用既有 httpClient，不另写 fetch 封装。
 */

import { httpClient } from './client'
import type { InteractionPlan } from '@/core/interaction/plan-decision'

export type ChatResult =
  | { kind: 'plan'; plan: InteractionPlan; intent: string }
  | { kind: 'refusal'; message: string; intent?: string }

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data
  if (
    body != null &&
    typeof body === 'object' &&
    'code' in body &&
    'data' in body &&
    (body as { data?: T }).data !== undefined
  ) {
    return (body as { data: T }).data
  }
  return body as T
}

class ChatApi {
  async sendMessage(message: string): Promise<ChatResult> {
    const response = await httpClient.post<unknown>('/api/chat/message', {
      message,
    })
    return unwrap<ChatResult>(response)
  }
}

export const chatApi = new ChatApi()
