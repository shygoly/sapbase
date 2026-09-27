// 只从契约里选，并且尊重契约自己声明的 agentInvocable。
// 为什么要有这几条：`agentInvocable` 是冻结协议里的字段，声明了就必须有人判 ——
// 否则契约写着"不给智能体"，编排器却照样选得到。
import type { ToolCatalog } from '../agent-tools/contracts-loader'
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import { CatalogToolSelector } from './tool-selector'

function catalogWithAgentInvocable(value: boolean | undefined): ToolCatalog {
  const real = loadToolCatalog()
  return {
    version: 1,
    tools: real.tools.map((tool) =>
      tool.name === 'erp_module_export'
        ? { ...tool, agentInvocable: value }
        : tool,
    ),
  }
}

describe('CatalogToolSelector', () => {
  it('契约里有的工具能选中', () => {
    const selector = new CatalogToolSelector(loadToolCatalog())
    expect(selector.select('erp_module_export')?.name).toBe('erp_module_export')
  })

  it('负例：契约里没有的工具 → undefined（未声明即不存在）', () => {
    const selector = new CatalogToolSelector(loadToolCatalog())
    expect(selector.select('erp_delete_order')).toBeUndefined()
  })

  it('负例：agentInvocable=false 的工具，智能体那道门选不到', () => {
    const selector = new CatalogToolSelector(catalogWithAgentInvocable(false))
    expect(selector.select('erp_module_export')).toBeUndefined()
  })

  it('agentInvocable=true（或未声明，默认 true）时可选', () => {
    expect(
      new CatalogToolSelector(catalogWithAgentInvocable(true)).select('erp_module_export'),
    ).toBeDefined()
    expect(
      new CatalogToolSelector(catalogWithAgentInvocable(undefined)).select('erp_module_export'),
    ).toBeDefined()
  })
})
