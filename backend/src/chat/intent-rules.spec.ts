// 规则表加载：规则是候选，契约是裁决。负例必须 fail-closed。
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import {
  INTENT_RULES,
  assertRulesTargetCatalog,
} from './intent-rules'
import { CatalogToolSelector } from './tool-selector'

describe('意图规则表（对真契约）', () => {
  it('每条规则的目标工具都 ∈ 真契约（不是内联假数据）', () => {
    const catalog = loadToolCatalog()
    expect(catalog.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'erp_blueprint_list',
        'erp_blueprint_manifest',
        'erp_blueprint_compile',
        'erp_atomic_invoke',
        'erp_module_list',
        'erp_module_export',
      ]),
    )
    expect(INTENT_RULES.length).toBeGreaterThan(0)
    expect(() => assertRulesTargetCatalog(INTENT_RULES, catalog)).not.toThrow()
    for (const rule of INTENT_RULES) {
      expect(catalog.tools.some((tool) => tool.name === rule.tool)).toBe(true)
    }
  })

  it('负例：规则指向契约里不存在的工具 → 加载即抛错', () => {
    const catalog = loadToolCatalog()
    expect(() =>
      assertRulesTargetCatalog(
        [{ id: 'ghost.delete', tool: 'erp_delete_order' }],
        catalog,
      ),
    ).toThrow(/不存在的工具/)
    expect(() =>
      assertRulesTargetCatalog(
        [{ id: 'ghost.delete', tool: 'erp_delete_order' }],
        catalog,
      ),
    ).toThrow(/erp_delete_order/)
  })

  it('ToolSelector 只从契约里选：未知名字不是候选', () => {
    const selector = new CatalogToolSelector(loadToolCatalog())
    expect(selector.select('erp_blueprint_list')?.name).toBe('erp_blueprint_list')
    expect(selector.select('erp_delete_order')).toBeUndefined()
  })
})
