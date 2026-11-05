import { BadRequestException } from '@nestjs/common'

/**
 * 从模型响应里提取一个 JSON 对象。
 *
 * 失败必须抛错：旧实现解析失败时返回“默认空 patch”，那会把“模型说胡话”
 * 变成“保存了一个合法但空的模块”，比直接失败危险得多。
 */
export function extractAiJsonObject(response: unknown): Record<string, unknown> {
  const text = extractResponseText(response)
  if (!text) {
    throw new BadRequestException('AI 响应没有文本内容')
  }

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new BadRequestException('AI 响应中没有 JSON 对象')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch (error) {
    throw new BadRequestException(
      `AI 响应 JSON 解析失败：${(error as Error).message}`,
    )
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException('AI 响应 JSON 必须是对象')
  }
  return parsed as Record<string, unknown>
}

/** Kimi/Moonshot、OpenAI、嵌套 data.content 三种常见响应形状。 */
function extractResponseText(response: unknown): string {
  const r = response as {
    content?: unknown
    choices?: Array<{ message?: { content?: unknown } }>
    data?: { content?: unknown }
  }
  if (r?.content != null) {
    if (Array.isArray(r.content) && r.content[0] != null) {
      const first = r.content[0] as { text?: unknown; content?: unknown }
      const text = first.text ?? first.content
      if (typeof text === 'string' && text.length > 0) return text
    } else if (typeof r.content === 'string') {
      return r.content
    }
  }
  const choice = r?.choices?.[0]?.message?.content
  if (typeof choice === 'string' && choice.length > 0) return choice
  const nested = r?.data?.content
  if (Array.isArray(nested) && nested[0] != null) {
    const first = nested[0] as { text?: unknown; content?: unknown }
    const text = first.text ?? first.content
    if (typeof text === 'string' && text.length > 0) return text
  }
  if (typeof nested === 'string') return nested
  return ''
}
