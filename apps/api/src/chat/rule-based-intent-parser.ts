/**
 * v1 确定性 IntentParser。能测、能复现、不碰网络。
 * null = 没有这个能力（不是异常）。
 */
import { loadToolCatalog, type ToolCatalog } from '../agent-tools/contracts-loader'
import type { ChatContext, Intent, IntentParser } from './chat.types'
import { INTENT_RULES, assertRulesTargetCatalog, type IntentRule } from './intent-rules'
import { CatalogToolSelector } from './tool-selector'

export class RuleBasedIntentParser implements IntentParser {
  private readonly selector: CatalogToolSelector

  constructor(
    private readonly rules: readonly IntentRule[] = INTENT_RULES,
    catalog: ToolCatalog = loadToolCatalog(),
  ) {
    assertRulesTargetCatalog(this.rules, catalog)
    this.selector = new CatalogToolSelector(catalog)
  }

  async parse(input: { message: string; context: ChatContext }): Promise<Intent | null> {
    void input.context
    const message = input.message.trim()
    if (!message) return null

    const hits: Intent[] = []
    for (const rule of this.rules) {
      const args = rule.tryMatch(message)
      if (args === null) continue
      if (!this.selector.select(rule.tool)) continue
      hits.push({
        id: rule.id,
        tool: rule.tool,
        args,
        label: rule.label,
      })
    }

    if (hits.length !== 1) return null
    return hits[0]
  }
}
