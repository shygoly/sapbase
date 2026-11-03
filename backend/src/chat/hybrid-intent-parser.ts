import type { ChatContext, Intent, IntentParser } from './chat.types'
import { LlmIntentPlanner } from './llm-intent-planner'
import { RuleBasedIntentParser } from './rule-based-intent-parser'

export class HybridIntentParser implements IntentParser {
  constructor(
    private readonly rules: RuleBasedIntentParser,
    private readonly llm: LlmIntentPlanner,
  ) {}

  async parse(input: { message: string; context: ChatContext }): Promise<Intent | null> {
    const deterministic = await this.rules.parse(input)
    if (deterministic) return deterministic
    return this.llm.parse(input)
  }
}
