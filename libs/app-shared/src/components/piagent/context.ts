export type PiAgentMode = 'help' | 'action'

export interface ContextChip {
  key: string
  label: string
  value: string
}

export const HELP_PROMPTS = [
  '这页怎么用？',
  '为什么按钮是灰的？',
  '这个配置去哪里改？',
]

export const ACTION_PROMPTS = [
  '帮我查当前页的数据',
  '帮我创建一个记录（先给确认卡）',
  '这页有哪些可用的操作？',
]

export function quickPrompts(mode: PiAgentMode): string[] {
  return mode === 'help' ? HELP_PROMPTS : ACTION_PROMPTS
}

export function buildContextSuffix(chips: ContextChip[]): string {
  if (chips.length === 0) return ''
  return `\n\n[context ${chips.map((chip) => `${chip.key}=${chip.value}`).join(' ')}]`
}
