/**
 * ToolSelector：只从契约里选。规则表是候选，契约才是裁决。
 */
import type { AgentToolContract, ToolCatalog } from '../agent-tools/contracts-loader'

export class CatalogToolSelector {
  constructor(private readonly catalog: ToolCatalog) {}

  /**
   * 只从契约里选，并且**尊重契约自己声明的 `agentInvocable`**。
   *
   * 为什么必须在这里判：`agentInvocable: false` 的意思是"这个工具不给智能体"，
   * 而编排器就是智能体的那道门（LLM 适配器提出的意图也要从这里过）。
   * 声明了却不判，等于给了一份**假的安全感** —— 边界要么被执行，要么不该写进契约。
   *
   * 说明：底层 `POST /agent-tools/:name/invoke` 是更低的通用面（由权限点守着），
   * 不做这层判断；"智能体不能选它"这条边界落在编排器这道门上。
   */
  select(name: string): AgentToolContract | undefined {
    const tool = this.catalog.tools.find((item) => item.name === name)
    if (!tool) return undefined
    if (tool.agentInvocable === false) return undefined
    return tool
  }
}
